import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { parseCourse, type Course } from '@gamatutor/course-schema';
import type { Db } from '../db/client';
import {
  attempts,
  certificates,
  courses,
  courseVersions,
  enrolments,
  results,
  topics,
} from '../db/schema';

export function storageRoot(): string {
  return process.env.GT_STORAGE_DIR ?? resolve(process.cwd(), 'storage');
}

/** Hash of course.json and every asset (path and bytes), in a stable order. */
export function contentHash(courseDir: string): string {
  const h = createHash('sha256');
  h.update(readFileSync(join(courseDir, 'course.json')));
  const assets = join(courseDir, 'assets');
  if (existsSync(assets)) {
    const files = (readdirSync(assets, { recursive: true, withFileTypes: true }) as import('node:fs').Dirent[])
      .filter((d) => d.isFile())
      .map((d) => join(d.parentPath, d.name))
      .sort();
    for (const f of files) {
      h.update(relative(assets, f).split(sep).join('/'));
      h.update(readFileSync(f));
    }
  }
  return h.digest('hex');
}

export interface PublishOptions {
  courseDir: string;
  topicSlug: string;
  topicTitle: string;
  summary?: string;
  storage?: string;
}

/**
 * Publishes a native course directory as a new immutable version. The course
 * row is created on first publish; later publishes add versions, and new
 * enrolments get the newest one while existing learners keep theirs.
 */
export async function publishCourse(db: Db, opts: PublishOptions) {
  const raw = JSON.parse(readFileSync(join(opts.courseDir, 'course.json'), 'utf8'));
  const manifest: Course = parseCourse(raw);
  const storage = opts.storage ?? storageRoot();
  const hash = contentHash(opts.courseDir);

  return db.transaction(async (tx) => {
    const [topic] = await tx
      .insert(topics)
      .values({ slug: opts.topicSlug, title: opts.topicTitle })
      .onConflictDoUpdate({ target: topics.slug, set: { title: opts.topicTitle } })
      .returning();
    let course = await tx.query.courses.findFirst({ where: eq(courses.slug, manifest.id) });
    if (!course) {
      [course] = await tx
        .insert(courses)
        .values({
          slug: manifest.id,
          topicId: topic!.id,
          title: manifest.title,
          summary: opts.summary ?? '',
        })
        .returning();
    } else {
      [course] = await tx
        .update(courses)
        .set({
          topicId: topic!.id,
          title: manifest.title,
          ...(opts.summary !== undefined ? { summary: opts.summary } : {}),
        })
        .where(eq(courses.id, course.id))
        .returning();
    }
    const latest = await tx.query.courseVersions.findFirst({
      where: eq(courseVersions.courseId, course!.id),
      orderBy: desc(courseVersions.version),
    });
    if (latest && latest.contentHash === hash) return { course: course!, version: latest, unchanged: true };
    const [{ next } = { next: 1 }] = await tx
      .select({ next: sql<number>`coalesce(max(${courseVersions.version}), 0) + 1` })
      .from(courseVersions)
      .where(eq(courseVersions.courseId, course!.id));
    const version = Number(next);
    const dir = join(manifest.id, `v${version}`);
    const target = join(storage, dir);
    mkdirSync(target, { recursive: true });
    const assets = join(opts.courseDir, 'assets');
    if (existsSync(assets)) cpSync(assets, join(target, 'assets'), { recursive: true });
    const [row] = await tx
      .insert(courseVersions)
      .values({ courseId: course!.id, version, manifest, storageDir: dir, contentHash: hash })
      .returning();
    return { course: course!, version: row!, unchanged: false };
  });
}

export type CourseState = 'baru' | 'berjalan' | 'lulus';

export interface CatalogueEntry {
  slug: string;
  title: string;
  summary: string;
  state: CourseState;
}

/** Published courses grouped by topic, with this learner's progress on each. */
export async function catalogue(db: Db, userId: string | null) {
  const rows = await db
    .select({
      topicSlug: topics.slug,
      topicTitle: topics.title,
      slug: courses.slug,
      title: courses.title,
      summary: courses.summary,
      enrolmentId: enrolments.id,
      certificateId: certificates.id,
    })
    .from(courses)
    .innerJoin(topics, eq(topics.id, courses.topicId))
    .leftJoin(
      enrolments,
      and(eq(enrolments.courseId, courses.id), eq(enrolments.userId, userId ?? sql`null`)),
    )
    .leftJoin(certificates, eq(certificates.enrolmentId, enrolments.id))
    .where(eq(courses.status, 'published'))
    .orderBy(asc(topics.sort), asc(topics.title), asc(courses.title));

  const groups = new Map<string, { slug: string; title: string; courses: CatalogueEntry[] }>();
  for (const r of rows) {
    const g = groups.get(r.topicSlug) ?? { slug: r.topicSlug, title: r.topicTitle, courses: [] };
    groups.set(r.topicSlug, g);
    g.courses.push({
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      state: r.certificateId ? 'lulus' : r.enrolmentId ? 'berjalan' : 'baru',
    });
  }
  return [...groups.values()];
}

export async function courseBySlug(db: Db, slug: string) {
  const course = await db.query.courses.findFirst({ where: eq(courses.slug, slug) });
  if (!course || course.status !== 'published') return null;
  const latest = await db.query.courseVersions.findFirst({
    where: eq(courseVersions.courseId, course.id),
    orderBy: desc(courseVersions.version),
  });
  return latest ? { course, latest } : null;
}

/** Enrols (idempotently) and returns the enrolment with its single attempt. */
export async function enrol(db: Db, userId: string, slug: string) {
  const found = await courseBySlug(db, slug);
  if (!found) return null;
  await db
    .insert(enrolments)
    .values({ userId, courseId: found.course.id, courseVersionId: found.latest.id })
    .onConflictDoNothing();
  const enrolment = (await db.query.enrolments.findFirst({
    where: and(eq(enrolments.userId, userId), eq(enrolments.courseId, found.course.id)),
  }))!;
  await db.insert(attempts).values({ enrolmentId: enrolment.id }).onConflictDoNothing();
  return enrolment;
}

/** Everything the player page needs, or null if the learner is not enrolled. */
export async function learningContext(db: Db, userId: string, slug: string) {
  const course = await db.query.courses.findFirst({ where: eq(courses.slug, slug) });
  if (!course) return null;
  const enrolment = await db.query.enrolments.findFirst({
    where: and(eq(enrolments.userId, userId), eq(enrolments.courseId, course.id)),
  });
  if (!enrolment) return null;
  const version = (await db.query.courseVersions.findFirst({
    where: eq(courseVersions.id, enrolment.courseVersionId),
  }))!;
  const attempt = (await db.query.attempts.findFirst({
    where: eq(attempts.enrolmentId, enrolment.id),
  }))!;
  const history = await db
    .select()
    .from(results)
    .where(eq(results.attemptId, attempt.id))
    .orderBy(asc(results.attemptNo));
  return { course, enrolment, version, attempt, history };
}

/** Enrolment check for asset requests. */
export async function canReadVersion(db: Db, userId: string, versionId: string): Promise<boolean> {
  const row = await db.query.enrolments.findFirst({
    where: and(eq(enrolments.userId, userId), eq(enrolments.courseVersionId, versionId)),
  });
  return !!row;
}
