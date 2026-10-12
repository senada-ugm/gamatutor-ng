import { asc, count, desc, eq } from 'drizzle-orm';
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
} from '../db/schema';
import { toCsv } from './csv';
import {
  activeSpans,
  dailyLearners,
  formatDuration,
  heatmap,
  learnerTimes,
  minutesPerModule,
  wibStamp,
  type TimedEvent,
} from './time-report';

export async function adminCourses(db: Db) {
  const rows = await db
    .select({ slug: courses.slug, title: courses.title, status: courses.status, learners: count(enrolments.id) })
    .from(courses)
    .leftJoin(enrolments, eq(enrolments.courseId, courses.id))
    .groupBy(courses.id)
    .orderBy(asc(courses.title));
  return rows;
}

async function courseEvents(db: Db, courseId: string): Promise<TimedEvent[]> {
  const rows = await db
    .select({ userId: events.userId, at: events.occurredAt, objectId: events.objectId })
    .from(events)
    .where(eq(events.courseId, courseId))
    .orderBy(asc(events.userId), asc(events.occurredAt));
  return rows;
}

export interface LearnerRow {
  userId: string;
  fullName: string;
  email: string;
  profession: string;
  institution: string;
  province: string;
  city: string;
  enrolledAt: Date;
  firstAt: Date | null;
  lastAt: Date | null;
  sessions: number;
  activeMs: number;
  attempts: number;
  lastScore: string;
  passed: boolean | null;
  certificate: string | null;
}

export async function courseReport(db: Db, slug: string, now = new Date()) {
  const course = await db.query.courses.findFirst({ where: eq(courses.slug, slug) });
  if (!course) return null;
  const latest = (await db.query.courseVersions.findFirst({
    where: eq(courseVersions.courseId, course.id),
    orderBy: desc(courseVersions.version),
  }))!;
  const manifest = latest.manifest as Course;

  const people = await db
    .select({
      userId: users.id,
      fullName: users.fullName,
      email: users.email,
      profession: users.profession,
      institution: users.institution,
      province: users.province,
      city: users.city,
      enrolledAt: enrolments.createdAt,
      attemptId: attempts.id,
      certificate: certificates.serial,
    })
    .from(enrolments)
    .innerJoin(users, eq(users.id, enrolments.userId))
    .innerJoin(attempts, eq(attempts.enrolmentId, enrolments.id))
    .leftJoin(certificates, eq(certificates.enrolmentId, enrolments.id))
    .where(eq(enrolments.courseId, course.id))
    .orderBy(asc(users.fullName));

  const allResults = await db
    .select({ attemptId: results.attemptId, no: results.attemptNo, raw: results.scoreRaw, max: results.scoreMax, passed: results.passed })
    .from(results)
    .innerJoin(attempts, eq(attempts.id, results.attemptId))
    .innerJoin(enrolments, eq(enrolments.id, attempts.enrolmentId))
    .where(eq(enrolments.courseId, course.id))
    .orderBy(asc(results.attemptNo));
  const resultsBy = new Map<string, typeof allResults>();
  for (const r of allResults) resultsBy.set(r.attemptId, [...(resultsBy.get(r.attemptId) ?? []), r]);

  const evs = await courseEvents(db, course.id);
  const times = learnerTimes(evs);
  const spans = activeSpans(evs);

  const learners: LearnerRow[] = people.map((p) => {
    const t = times.get(p.userId);
    const rs = resultsBy.get(p.attemptId) ?? [];
    const last = rs.at(-1);
    return {
      userId: p.userId,
      fullName: p.fullName,
      email: p.email,
      profession: p.profession,
      institution: p.institution,
      province: p.province,
      city: p.city,
      enrolledAt: p.enrolledAt,
      firstAt: t?.firstAt ?? null,
      lastAt: t?.lastAt ?? null,
      sessions: t?.sessions ?? 0,
      activeMs: t?.activeMs ?? 0,
      attempts: rs.length,
      lastScore: last ? `${last.raw}/${last.max}` : '',
      passed: last ? last.passed : null,
      certificate: p.certificate,
    };
  });

  const moduleOf = new Map<string, string>();
  const order: string[] = [];
  for (const m of manifest.modules) {
    if (m.completion || m.pages.length === 0) continue;
    order.push(m.label);
    for (const p of m.pages) moduleOf.set(p.id, m.label);
  }

  const active = learners.filter((l) => l.activeMs > 0);
  return {
    course,
    learners,
    totals: {
      enrolled: learners.length,
      started: learners.filter((l) => l.firstAt).length,
      passed: learners.filter((l) => l.passed).length,
      certified: learners.filter((l) => l.certificate).length,
      medianActive: formatDuration(
        active.length ? [...active].sort((a, b) => a.activeMs - b.activeMs)[Math.floor(active.length / 2)]!.activeMs : 0,
      ),
    },
    heatmap: heatmap(spans),
    daily: dailyLearners(evs, 30, now),
    modules: minutesPerModule(spans, moduleOf, order),
  };
}

export function learnersCsv(rows: LearnerRow[]): string {
  return toCsv(
    [
      'nama_lengkap', 'email', 'profesi', 'instansi', 'provinsi', 'kab_kota', 'terdaftar_wib',
      'akses_pertama_wib', 'akses_terakhir_wib', 'jumlah_sesi', 'waktu_aktif_menit',
      'jumlah_percobaan', 'skor_terakhir', 'lulus', 'sertifikat',
    ],
    rows.map((r) => [
      r.fullName, r.email, r.profession, r.institution, r.province, r.city, wibStamp(r.enrolledAt),
      r.firstAt ? wibStamp(r.firstAt) : '', r.lastAt ? wibStamp(r.lastAt) : '', r.sessions,
      Math.round(r.activeMs / 60_000), r.attempts, r.lastScore,
      r.passed === null ? '' : r.passed ? 'ya' : 'tidak', r.certificate ?? '',
    ]),
  );
}

export async function eventsCsv(db: Db, slug: string): Promise<string | null> {
  const course = await db.query.courses.findFirst({ where: eq(courses.slug, slug) });
  if (!course) return null;
  const rows = await db
    .select({
      at: events.occurredAt,
      fullName: users.fullName,
      email: users.email,
      profession: users.profession,
      institution: users.institution,
      verb: events.verb,
      objectId: events.objectId,
      result: events.result,
    })
    .from(events)
    .innerJoin(users, eq(users.id, events.userId))
    .where(eq(events.courseId, course.id))
    .orderBy(asc(events.occurredAt));
  return toCsv(
    ['waktu_wib', 'waktu_utc', 'nama_lengkap', 'email', 'profesi', 'instansi', 'aksi', 'halaman', 'jawaban', 'benar', 'skor'],
    rows.map((r) => {
      const res = (r.result ?? {}) as { response?: string; success?: boolean; score?: { raw: number; max: number } };
      return [
        wibStamp(r.at), r.at.toISOString(), r.fullName, r.email, r.profession, r.institution, r.verb, r.objectId,
        res.response ?? '', res.success === undefined ? '' : res.success ? 'ya' : 'tidak',
        res.score ? `${res.score.raw}/${res.score.max}` : '',
      ];
    }),
  );
}
