import { and, desc, eq, gt, lte, sql } from 'drizzle-orm';
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
  context: z
    .record(z.unknown())
    .refine((c) => JSON.stringify(c).length <= 2_000, 'context too large')
    .optional(),
});
export const IncomingBatch = z.object({ events: z.array(IncomingEvent).max(500) });
export type IncomingEvent = z.infer<typeof IncomingEvent>;

/** Clock skew we accept from a learner's device before trusting our own clock. */
const SKEW_MS = 10 * 60_000;

/**
 * A device clock can be anywhere. Events are kept inside the attempt's life:
 * not before it started, not after now.
 */
export function clampTime(t: Date, startedAt: Date, now: Date): Date {
  if (Number.isNaN(t.getTime())) return now;
  if (t.getTime() > now.getTime() + SKEW_MS) return now;
  if (t.getTime() > now.getTime()) return now;
  if (t.getTime() < startedAt.getTime() - SKEW_MS) return startedAt;
  return t;
}

type Quiz = { id: string; correct: string };

function gradedQuizzes(manifest: Course): Quiz[] {
  return manifest.modules
    .flatMap((m) => m.pages)
    .filter((p): p is Extract<typeof p, { type: 'quiz' }> => p.type === 'quiz' && p.graded)
    .map((p) => ({ id: p.id, correct: p.correct }));
}

/**
 * The score as the server sees it: each graded question's latest answer
 * since the previous result, checked against the course's own key. The
 * browser's claimed score and verdict are never trusted.
 */
export function scoreFromAnswers(
  quizzes: readonly Quiz[],
  answers: ReadonlyArray<{ objectId: string; response: string | undefined; at: Date }>,
): { raw: number; max: number; answered: number } {
  const latest = new Map<string, { response: string | undefined; at: Date }>();
  for (const a of answers) {
    const prev = latest.get(a.objectId);
    if (!prev || a.at >= prev.at) latest.set(a.objectId, a);
  }
  let raw = 0;
  let answered = 0;
  for (const q of quizzes) {
    const a = latest.get(q.id);
    if (!a) continue;
    answered++;
    if (a.response === q.correct) raw++;
  }
  return { raw, max: quizzes.length, answered };
}

export class AttemptNotFound extends Error {
  constructor() {
    super('attempt not found');
  }
}

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
  if (!owned) throw new AttemptNotFound();
  if (batch.length === 0) return { accepted: 0 };
  return db.transaction(async (tx) => {
    const rows = batch.map((e) => {
      const occurredAt = clampTime(new Date(e.timestamp), owned.attempt.startedAt, now);
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

    const completions = inserted
      .filter((e) => e.verb === 'passed' || e.verb === 'failed')
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    if (completions.length) {
      const version = (await tx.query.courseVersions.findFirst({
        where: eq(courseVersions.id, owned.enrolment.courseVersionId),
      }))!;
      const manifest = version.manifest as Course;
      const quizzes = gradedQuizzes(manifest);
      for (const e of completions) {
        const claimed = Number((e.context as { attempt?: number } | null)?.attempt ?? 0) || null;
        const prev = await tx.query.results.findFirst({
          where: eq(results.attemptId, attemptId),
          orderBy: desc(results.attemptNo),
        });
        // A reload can report the same attempt twice; that is not a new one.
        if (prev && claimed !== null && prev.clientAttempt === claimed) continue;
        const since = prev?.completedAt ?? new Date(0);
        const answers = await tx
          .select({ objectId: events.objectId, result: events.result, at: events.occurredAt })
          .from(events)
          .where(
            and(
              eq(events.attemptId, attemptId),
              eq(events.verb, 'answered'),
              gt(events.occurredAt, since),
              lte(events.occurredAt, e.occurredAt),
            ),
          );
        const score = scoreFromAnswers(
          quizzes,
          answers.map((a) => ({
            objectId: a.objectId,
            response: (a.result as { response?: string } | null)?.response,
            at: a.at,
          })),
        );
        // Not every question answered: the player never reports that, so
        // this did not come from it. Record nothing.
        if (score.answered < score.max) continue;
        const passed = score.max === 0 || score.raw / score.max >= manifest.passingScore;
        await tx.insert(results).values({
          attemptId,
          attemptNo: (prev?.attemptNo ?? 0) + 1,
          clientAttempt: claimed,
          scoreRaw: score.raw,
          scoreMax: score.max,
          passed,
          completedAt: e.occurredAt,
        });
      }
    }
    const latest = inserted.reduce<Date | null>(
      (m, e) => (!m || e.occurredAt > m ? e.occurredAt : m),
      null,
    );
    if (latest) {
      // An offline queue arriving late must not move "last seen" backwards.
      await tx
        .update(attempts)
        .set({
          // An explicit cast: postgres-js will not bind a Date into raw SQL.
          lastSeenAt: sql`greatest(${attempts.lastSeenAt}, cast(${latest.toISOString()} as timestamptz))`,
        })
        .where(eq(attempts.id, attemptId));
    }
    return { accepted: inserted.length };
  });
}

/**
 * Keeps the latest player state; the learner resumes from it. Saves can
 * arrive out of order (a beacon racing a fetch), so each carries a sequence
 * number and an older one never replaces a newer one.
 */
export async function saveResumeState(
  db: Db,
  userId: string,
  attemptId: string,
  state: unknown,
  seq = Date.now(),
): Promise<boolean> {
  const owned = await attemptForUser(db, userId, attemptId);
  if (!owned) throw new AttemptNotFound();
  const json = JSON.stringify(state ?? null);
  if (json.length > 200_000) throw new Error('state too large');
  const updated = await db
    .update(attempts)
    .set({ resumeState: JSON.parse(json), resumeSeq: seq })
    .where(and(eq(attempts.id, attemptId), sql`coalesce(${attempts.resumeSeq}, 0) < ${seq}`))
    .returning({ id: attempts.id });
  return updated.length > 0;
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
    .select({
      cert: certificates,
      userId: enrolments.userId,
      courseSlug: courses.slug,
      identityVerifiedAt: users.identityVerifiedAt,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(certificates)
    .innerJoin(enrolments, eq(enrolments.id, certificates.enrolmentId))
    .innerJoin(courses, eq(courses.id, enrolments.courseId))
    .innerJoin(users, eq(users.id, enrolments.userId))
    .where(eq(certificates.serial, serial.toUpperCase()));
  return row ?? null;
}
