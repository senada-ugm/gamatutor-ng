import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Course } from '@gamatutor/course-schema';
import type { Db } from '../db/client';
import {
  attempts,
  certificates,
  courses,
  courseVersions,
  enrolments,
  events,
  results,
  users,
  type CertificateSnapshot,
} from '../db/schema';
import { newSerial } from './tokens';

/** What the browser sends; mirrors @gamatutor/tracking's Statement plus an id. */
export const IncomingEvent = z.object({
  clientEventId: z.string().uuid(),
  verb: z.string().min(1).max(40),
  objectId: z.string().min(1).max(200),
  timestamp: z.string().datetime({ offset: true }),
  result: z
    .object({
      response: z.string().max(500).optional(),
      success: z.boolean().optional(),
      score: z.object({ raw: z.number(), min: z.number(), max: z.number() }).optional(),
    })
    .optional(),
  context: z.record(z.unknown()).optional(),
});
export const IncomingBatch = z.object({ events: z.array(IncomingEvent).max(500) });
export type IncomingEvent = z.infer<typeof IncomingEvent>;

/** Clock skew we accept from a learner's device before trusting our own clock. */
const SKEW_MS = 10 * 60_000;

/** The attempt, if it belongs to this user; ingest never crosses learners. */
export async function attemptForUser(db: Db, userId: string, attemptId: string) {
  const [row] = await db
    .select({ attempt: attempts, enrolment: enrolments })
    .from(attempts)
    .innerJoin(enrolments, eq(enrolments.id, attempts.enrolmentId))
    .where(and(eq(attempts.id, attemptId), eq(enrolments.userId, userId)));
  return row ?? null;
}

/**
 * Appends events idempotently. A `passed`/`failed` statement also records the
 * evaluation result, in the same transaction, so reports never see one
 * without the other.
 */
export async function ingest(
  db: Db,
  userId: string,
  attemptId: string,
  batch: IncomingEvent[],
  now = new Date(),
): Promise<{ accepted: number }> {
  const owned = await attemptForUser(db, userId, attemptId);
  if (!owned) throw new Error('attempt not found');
  if (batch.length === 0) return { accepted: 0 };
  return db.transaction(async (tx) => {
    const rows = batch.map((e) => {
      const t = new Date(e.timestamp);
      const occurredAt = Math.abs(t.getTime() - now.getTime()) > SKEW_MS && t > now ? now : t;
      return {
        attemptId,
        userId,
        courseId: owned.enrolment.courseId,
        occurredAt,
        receivedAt: now,
        verb: e.verb,
        objectId: e.objectId,
        result: e.result ?? null,
        context: e.context ?? null,
        clientEventId: e.clientEventId,
      };
    });
    const inserted = await tx
      .insert(events)
      .values(rows)
      .onConflictDoNothing({ target: events.clientEventId })
      .returning({ id: events.id, verb: events.verb, result: events.result, context: events.context, occurredAt: events.occurredAt });

    for (const e of inserted) {
      if (e.verb !== 'passed' && e.verb !== 'failed') continue;
      const r = e.result as IncomingEvent['result'];
      const ctx = e.context as { attempt?: number } | null;
      if (!r?.score) continue;
      await tx
        .insert(results)
        .values({
          attemptId,
          attemptNo: Number(ctx?.attempt ?? 1),
          scoreRaw: Math.round(r.score.raw),
          scoreMax: Math.round(r.score.max),
          passed: e.verb === 'passed',
          completedAt: e.occurredAt,
        })
        .onConflictDoUpdate({
          target: [results.attemptId, results.attemptNo],
          set: {
            scoreRaw: Math.round(r.score.raw),
            scoreMax: Math.round(r.score.max),
            passed: e.verb === 'passed',
            completedAt: e.occurredAt,
          },
        });
    }
    const latest = inserted.reduce<Date | null>(
      (m, e) => (!m || e.occurredAt > m ? e.occurredAt : m),
      null,
    );
    if (latest) {
      await tx.update(attempts).set({ lastSeenAt: latest }).where(eq(attempts.id, attemptId));
    }
    return { accepted: inserted.length };
  });
}

/** Keeps the latest player state; the learner resumes from it. */
export async function saveResumeState(db: Db, userId: string, attemptId: string, state: unknown) {
  const owned = await attemptForUser(db, userId, attemptId);
  if (!owned) throw new Error('attempt not found');
  // Only what the player needs to resume; never trust a giant blob.
  const json = JSON.stringify(state ?? null);
  if (json.length > 200_000) throw new Error('state too large');
  await db.update(attempts).set({ resumeState: JSON.parse(json) }).where(eq(attempts.id, attemptId));
}

export class CertificateError extends Error {}

/**
 * Issues the certificate for an attempt whose latest result passed, or
 * returns the one already issued. The snapshot freezes the account name at
 * this moment, so a later profile edit does not rewrite it.
 */
export async function issueCertificate(db: Db, userId: string, attemptId: string) {
  const owned = await attemptForUser(db, userId, attemptId);
  if (!owned) throw new CertificateError('Kursus tidak ditemukan.');
  const existing = await db.query.certificates.findFirst({
    where: eq(certificates.enrolmentId, owned.enrolment.id),
  });
  if (existing) return existing;
  const latest = await db.query.results.findFirst({
    where: eq(results.attemptId, attemptId),
    orderBy: desc(results.attemptNo),
  });
  if (!latest?.passed) throw new CertificateError('Sertifikat diterbitkan setelah Anda lulus evaluasi.');
  const user = (await db.query.users.findFirst({ where: eq(users.id, userId) }))!;
  const version = (await db.query.courseVersions.findFirst({
    where: eq(courseVersions.id, owned.enrolment.courseVersionId),
  }))!;
  const manifest = version.manifest as Course;
  const snapshot: CertificateSnapshot = {
    name: user.fullName,
    courseTitle: manifest.title,
    brand: manifest.brand.name,
    certificateText:
      manifest.completion?.certificateText ?? `telah menyelesaikan pelatihan “${manifest.title}”.`,
    scoreRaw: latest.scoreRaw,
    scoreMax: latest.scoreMax,
    issuedAt: new Date().toISOString(),
  };
  for (let tries = 0; tries < 5; tries++) {
    const [row] = await db
      .insert(certificates)
      .values({ enrolmentId: owned.enrolment.id, serial: newSerial(), snapshot })
      .onConflictDoNothing()
      .returning();
    if (row) return row;
    const raced = await db.query.certificates.findFirst({
      where: eq(certificates.enrolmentId, owned.enrolment.id),
    });
    if (raced) return raced;
  }
  throw new CertificateError('Sertifikat belum bisa diterbitkan. Coba lagi.');
}

export async function certificateBySerial(db: Db, serial: string) {
  const [row] = await db
    .select({ cert: certificates, userId: enrolments.userId, courseSlug: courses.slug })
    .from(certificates)
    .innerJoin(enrolments, eq(enrolments.id, certificates.enrolmentId))
    .innerJoin(courses, eq(courses.id, enrolments.courseId))
    .where(eq(certificates.serial, serial.toUpperCase()));
  return row ?? null;
}
