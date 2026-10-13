import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const id = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`);

// ---------------------------------------------------------------- identity

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'learner'] })
    .notNull()
    .default('learner'),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  fullName: text('full_name').notNull(),
  birthDate: date('birth_date').notNull(),
  profession: text('profession').notNull(),
  institution: text('institution').notNull(),
  province: text('province').notNull(),
  city: text('city').notNull(),
  phone: text('phone').notNull(),
  createdAt: created(),
});

/** `id` is the SHA-256 of the cookie token; the token itself is never stored. */
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: created(),
});

export const emailTokens = pgTable('email_tokens', {
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  purpose: text('purpose', { enum: ['verify', 'reset'] }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: created(),
});

// --------------------------------------------------------------- catalogue

export const topics = pgTable('topics', {
  id: id(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  sort: integer('sort').notNull().default(0),
});

export const courses = pgTable('courses', {
  id: id(),
  slug: text('slug').notNull().unique(),
  topicId: uuid('topic_id')
    .notNull()
    .references(() => topics.id),
  title: text('title').notNull(),
  summary: text('summary').notNull().default(''),
  status: text('status', { enum: ['published', 'hidden'] })
    .notNull()
    .default('published'),
  createdAt: created(),
});

/** Immutable once written; a new publish makes a new version. */
export const courseVersions = pgTable(
  'course_versions',
  {
    id: id(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id),
    version: integer('version').notNull(),
    manifest: jsonb('manifest').notNull(),
    storageDir: text('storage_dir').notNull(),
    /** sha256 of course.json and every asset; an unchanged course is not republished. */
    contentHash: text('content_hash'),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.courseId, t.version)],
);

export const enrolments = pgTable(
  'enrolments',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id),
    courseVersionId: uuid('course_version_id')
      .notNull()
      .references(() => courseVersions.id),
    createdAt: created(),
  },
  (t) => [unique().on(t.userId, t.courseId)],
);

// ------------------------------------------------------------------- spine

export const attempts = pgTable('attempts', {
  id: id(),
  enrolmentId: uuid('enrolment_id')
    .notNull()
    .unique()
    .references(() => enrolments.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  resumeState: jsonb('resume_state'),
  /** Sequence of the stored resume state; an older save never replaces it. */
  resumeSeq: bigint('resume_seq', { mode: 'number' }),
});

/** Append-only. Replays are absorbed by the unique client_event_id. */
export const events = pgTable(
  'events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    verb: text('verb').notNull(),
    objectId: text('object_id').notNull(),
    result: jsonb('result'),
    context: jsonb('context'),
    clientEventId: uuid('client_event_id').notNull().unique(),
  },
  (t) => [
    index('events_course_time').on(t.courseId, t.occurredAt),
    index('events_attempt_time').on(t.attemptId, t.occurredAt),
  ],
);

/** One row per evaluation attempt inside an attempt (a retake adds a row). */
export const results = pgTable(
  'results',
  {
    id: id(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => attempts.id, { onDelete: 'cascade' }),
    attemptNo: integer('attempt_no').notNull(),
    /** The attempt number the player reported, to recognise a repeated report. */
    clientAttempt: integer('client_attempt'),
    scoreRaw: integer('score_raw').notNull(),
    scoreMax: integer('score_max').notNull(),
    passed: boolean('passed').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
  },
  (t) => [unique().on(t.attemptId, t.attemptNo)],
);

/** The snapshot freezes name, course, score and date at issue. */
export const certificates = pgTable('certificates', {
  id: id(),
  enrolmentId: uuid('enrolment_id')
    .notNull()
    .unique()
    .references(() => enrolments.id, { onDelete: 'cascade' }),
  serial: text('serial').notNull().unique(),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  snapshot: jsonb('snapshot').notNull(),
});

export type User = typeof users.$inferSelect;
export type CertificateSnapshot = {
  name: string;
  courseTitle: string;
  brand: string;
  certificateText: string;
  scoreRaw: number;
  scoreMax: number;
  issuedAt: string;
};
