/**
 * Hand-authored application tables, kept separate from schema.ts (which
 * `npx auth@1.7.1 generate` owns and overwrites on every regen — see
 * AGENTS.md). db/index.ts merges this with schema.ts into one Drizzle
 * schema object.
 */
import type { ContractCourseInstructorSummary, ContractModule } from "@workspace/contracts/domain"
import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

/** An approved institution — a training provider on the platform. Mirrors
 *  packages/contracts/spec/institutions.tsp's RegisteredInstitution. */
export const institutions = pgTable("institutions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  institutionType: text("institution_type").notNull(),
  description: text("description"),
  website: text("website"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  logo: text("logo"),
  status: text("status").notNull().default("approved"),
  /** Free-form extension point — whatever the product hasn't modeled yet.
   *  Schemaless by design: the contract surfaces it as an opaque
   *  Record<unknown> and the service passes it through untouched. */
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

/** The many-to-many join: this user administers this institution. Mirrors
 *  InstitutionOwnership. userId is not FK-constrained against Better
 *  Auth's user table — ownership rows can reference any account id, and
 *  cross-schema FKs between hand-authored and generated tables add
 *  coupling this mockup-backend doesn't need yet. */
export const institutionOwnerships = pgTable(
  "institution_ownerships",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    grantedAt: timestamp("granted_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("institution_ownerships_user_institution_idx").on(table.userId, table.institutionId)]
)

/** A self-service request to register an institution — the "Ajukan
 *  Institusi" queue any signed-in account can submit to and only an admin
 *  can approve/reject. Mirrors InstitutionRequest. requestedByUserId is
 *  not FK-constrained against Better Auth's user table, same reasoning as
 *  institutionOwnerships.userId — requestedByUser's display name/email
 *  are looked up via a join at read time rather than denormalized here,
 *  so they can't go stale. */
export const institutionRequests = pgTable("institution_requests", {
  id: text("id").primaryKey(),
  institutionName: text("institution_name").notNull(),
  institutionType: text("institution_type").notNull(),
  description: text("description"),
  website: text("website"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  logo: text("logo"),
  justification: text("justification"),
  requestedByUserId: text("requested_by_user_id").notNull(),
  status: text("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

/** A course, owned by an institution. Mirrors
 *  packages/contracts/spec/courses.tsp's Course. instructor/modules are
 *  JSONB — nested nested nested, no relational need for them yet, same
 *  call the mock layer already made. */
export const courses = pgTable(
  "courses",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    shortDescription: text("short_description"),
    description: text("description"),
    thumbnail: text("thumbnail"),
    courseType: text("course_type").notNull(),
    location: text("location"),
    scheduledAt: timestamp("scheduled_at"),
    scheduledEndAt: timestamp("scheduled_end_at"),
    registrationOpenAt: timestamp("registration_open_at"),
    registrationCloseAt: timestamp("registration_close_at"),
    registrantQuota: integer("registrant_quota"),
    participantQuota: integer("participant_quota"),
    registrantCount: integer("registrant_count").notNull().default(0),
    participantCount: integer("participant_count").notNull().default(0),
    level: text("level").notNull(),
    language: text("language").notNull(),
    trainingType: text("training_type"),
    customTrainingType: text("custom_training_type"),
    isDisabilityFriendly: boolean("is_disability_friendly").notNull().default(false),
    supportedDisabilityTypes: jsonb("supported_disability_types").$type<string[]>().notNull().default([]),
    minimumEducation: text("minimum_education"),
    minimumAge: integer("minimum_age"),
    maximumAge: integer("maximum_age"),
    cityCode: text("city_code"),
    fundingSource: text("funding_source"),
    customFundingSource: text("custom_funding_source"),
    trainingBudget: integer("training_budget"),
    contactPersonName: text("contact_person_name"),
    contactPersonPhone: text("contact_person_phone"),
    status: text("status").notNull().default("draft"),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    instructor: jsonb("instructor").$type<ContractCourseInstructorSummary>().notNull(),
    modules: jsonb("modules").$type<ContractModule[]>().notNull().default([]),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  // Postgres does not auto-index FK columns — every course-by-institution
  // lookup (owner/admin lists, visibility scoping) would seq-scan without
  // this. The status CHECK keeps the DB honest even if a future write
  // path skips the zod layer (the backend only ever writes draft/published
  // today; widening the lifecycle means widening this constraint too).
  (table) => [
    index("courses_institution_idx").on(table.institutionId),
    check("courses_status_check", sql`${table.status} in ('draft', 'published')`),
  ]
)

/** A file uploaded through the general upload service (see
 *  src/modules/uploads). Starts `unclaimed`; the owning entity's service
 *  call (e.g. courses.service.ts) flips it to `claimed` when it saves a
 *  reference to this upload's URL, and flips it back to `unclaimed` (with
 *  releasedAt set) if that reference is later replaced. A background
 *  sweep deletes anything still `unclaimed` past UPLOAD_ORPHAN_TTL_HOURS,
 *  keyed off COALESCE(released_at, created_at). uploadedByUserId is not
 *  FK-constrained against Better Auth's user table, same reasoning as
 *  institutionOwnerships.userId above. */
export const uploads = pgTable("uploads", {
  id: text("id").primaryKey(),
  purpose: text("purpose").notNull(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storageKey: text("storage_key").notNull(),
  status: text("status").notNull().default("unclaimed"),
  uploadedByUserId: text("uploaded_by_user_id").notNull(),
  ownerType: text("owner_type"),
  ownerId: text("owner_id"),
  claimedAt: timestamp("claimed_at"),
  releasedAt: timestamp("released_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

/** A top-level content grouping within a course. Replaces the old
 *  `courses.modules` JSONB blob — courses.service.ts's toCourse() now
 *  composes Course.modules by querying this + course_lessons instead of
 *  reading a column, keeping the response shape unchanged. */
export const courseModules = pgTable(
  "course_modules",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("course_modules_course_idx").on(table.courseId)]
)

export const courseLessons = pgTable(
  "course_lessons",
  {
    id: text("id").primaryKey(),
    moduleId: text("module_id")
      .notNull()
      .references(() => courseModules.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    isPreview: boolean("is_preview").notNull().default(false),
    contentType: text("content_type"),
    textContent: text("text_content"),
    url: text("url"),
    duration: integer("duration"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("course_lessons_module_idx").on(table.moduleId)]
)

/** A student's completion mark on one lesson. userId is not FK-constrained
 *  against Better Auth's user table, same reasoning as institutionOwnerships
 *  .userId above. courseId is denormalized off the lesson's module chain so
 *  "this user's progress in this course" doesn't need a join through
 *  course_modules. */
export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => courseLessons.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("lesson_progress_user_lesson_idx").on(table.userId, table.lessonId),
    index("lesson_progress_course_idx").on(table.courseId),
  ]
)

/** Detailed dwell time and interaction telemetry for clinical learning research.
 *  Records per-slide entry/exit timestamps, active dwell duration, voiceover audio
 *  listen time, and element interactions. Backs CSV research exports for FK-KMK UGM. */
export const learningTelemetryLogs = pgTable(
  "learning_telemetry_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    courseId: text("course_id").notNull(),
    moduleId: text("module_id"),
    slideId: text("slide_id").notNull(),
    sessionId: text("session_id"),
    enteredAt: timestamp("entered_at").notNull(),
    exitedAt: timestamp("exited_at"),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    audioListenedSeconds: integer("audio_listened_seconds").notNull().default(0),
    interactedElements: jsonb("interacted_elements").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("learning_telemetry_user_idx").on(table.userId),
    index("learning_telemetry_course_idx").on(table.courseId),
    index("learning_telemetry_slide_idx").on(table.slideId),
    index("learning_telemetry_created_at_idx").on(table.createdAt),
  ]
)

/** A per-course instructor assignment/invite. userId is resolved by email
 *  lookup against `user` at invite time and re-checked on each read (an
 *  invite accepted before the invitee had an account backfills once they
 *  sign up). Mirrors packages/contracts/spec/course-instructors.tsp's
 *  CourseInstructor. */
export const courseInstructors = pgTable(
  "course_instructors",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    userId: text("user_id"),
    role: text("role").notNull().default("instructor"),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("course_instructors_course_email_idx").on(table.courseId, table.email),
    index("course_instructors_user_idx").on(table.userId),
  ]
)

/** A student's registration/participation in a course. Mirrors
 *  packages/contracts/spec/enrollments.tsp's Enrollment. userId is not
 *  FK-constrained against Better Auth's user table, same reasoning as
 *  institutionOwnerships.userId above. */
export const enrollments = pgTable(
  "enrollments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("registered"),
    enrollmentType: text("enrollment_type").notNull().default("free"),
    enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
    approvedAt: timestamp("approved_at"),
    interviewedAt: timestamp("interviewed_at"),
    interviewNotes: text("interview_notes"),
    failedAt: timestamp("failed_at"),
    failureReason: text("failure_reason"),
    failureNotes: text("failure_notes"),
    completedAt: timestamp("completed_at"),
    finalGrade: integer("final_grade"),
    certificateIssued: boolean("certificate_issued").notNull().default(false),
    certificateId: text("certificate_id"),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    uniqueIndex("enrollments_user_course_idx")
      .on(table.userId, table.courseId)
      .where(sql`${table.deletedAt} is null`),
    index("enrollments_course_idx").on(table.courseId),
    check(
      "enrollments_status_check",
      sql`${table.status} in ('registered', 'interviewed', 'selected', 'failed', 'graduated', 'canceled')`
    ),
  ]
)

/** The applicant-detail profile behind an enrollment. `id` is the SAME
 *  identifier as the account's Better Auth user id (per
 *  enrollments.tsp's ParticipantProfile doc comment) — not a separately
 *  generated id, so it's a 1:1 extension of the account rather than a
 *  child row. */
export const participantProfiles = pgTable("participant_profiles", {
  id: text("id").primaryKey(),
  phone: text("phone"),
  profession: text("profession"),
  institutionName: text("institution_name"),
  strNumber: text("str_number"),
  about: text("about"),
  educationLevel: text("education_level"),
  address: text("address"),
  residentialAddress: text("residential_address"),
  dati2: text("dati2"),
  gender: text("gender"),
  nationality: text("nationality"),
  religion: text("religion"),
  maritalStatus: text("marital_status"),
  birthDate: date("birth_date"),
  ktpNumber: text("ktp_number"),
  bpjsKesehatanNumber: text("bpjs_kesehatan_number"),
  education: jsonb("education").$type<Array<Record<string, unknown>>>().notNull().default([]),
  experience: jsonb("experience").$type<Array<Record<string, unknown>>>().notNull().default([]),
  certifications: jsonb("certifications").$type<Array<Record<string, unknown>>>().notNull().default([]),
})

/** Per-course certificate template configuration. A dedicated table
 *  (rather than a JSONB column on `courses`) so signature edits don't
 *  touch the course row and the domain gets its own module, same shape as
 *  every other course-scoped feature here. */
export const certificateSettings = pgTable("certificate_settings", {
  id: text("id").primaryKey(),
  courseId: text("course_id")
    .notNull()
    .unique()
    .references(() => courses.id, { onDelete: "cascade" }),
  signatures: jsonb("signatures").$type<Array<Record<string, unknown>>>().notNull().default([]),
  customFieldLabels: jsonb("custom_field_labels").$type<string[]>().notNull().default([]),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

/** An issued certificate. The server stores structured metadata only —
 *  rendering + print/export stays client-side (certificate-template.tsx),
 *  no server-side PDF pipeline. */
export const certificates = pgTable(
  "certificates",
  {
    id: text("id").primaryKey(),
    enrollmentId: text("enrollment_id")
      .notNull()
      .unique()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    certificateNumber: text("certificate_number").notNull().unique(),
    verificationCode: text("verification_code").notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),
    customFields: jsonb("custom_fields").$type<Record<string, string>>().notNull().default({}),
    issuedAt: timestamp("issued_at").defaultNow().notNull(),
  },
  (table) => [index("certificates_course_idx").on(table.courseId), index("certificates_user_idx").on(table.userId)]
)

export const discussions = pgTable(
  "discussions",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id").references(() => courseLessons.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    userId: text("user_id").notNull(),
    isPinned: boolean("is_pinned").notNull().default(false),
    isClosed: boolean("is_closed").notNull().default(false),
    isResolved: boolean("is_resolved").notNull().default(false),
    viewCount: integer("view_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("discussions_course_idx").on(table.courseId)]
)

export const discussionReplies = pgTable(
  "discussion_replies",
  {
    id: text("id").primaryKey(),
    discussionId: text("discussion_id")
      .notNull()
      .references(() => discussions.id, { onDelete: "cascade" }),
    parentReplyId: text("parent_reply_id"),
    content: text("content").notNull(),
    userId: text("user_id").notNull(),
    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("discussion_replies_discussion_idx").on(table.discussionId)]
)

/** courseId is nullable: a quiz with no course is a standalone assessment
 *  (career/psychometric test) - see quizzes.tsp's top comment. courseId
 *  IS NULL is the only discriminator; there is deliberately no separate
 *  "kind" column to avoid redundant state that could drift out of sync. */
export const quizzes = pgTable(
  "quizzes",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id").references(() => courses.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id").references(() => courseLessons.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    passingScore: integer("passing_score").notNull().default(70),
    maxAttempts: integer("max_attempts").notNull().default(1),
    timeLimit: integer("time_limit"),
    shuffleQuestions: boolean("shuffle_questions").notNull().default(false),
    shuffleOptions: boolean("shuffle_options").notNull().default(false),
    showResults: boolean("show_results").notNull().default(true),
    showCorrectAnswers: boolean("show_correct_answers").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [index("quizzes_course_idx").on(table.courseId)]
)

/** `correctAnswers` is server-only — never serialize it into the public
 *  QuizQuestion response a student sees before/while attempting (see
 *  quizzes.service.ts's toPublicQuestion() vs toAuthoringQuestion()). */
export const quizQuestions = pgTable("quiz_questions", {
  id: text("id").primaryKey(),
  quizId: text("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  questionType: text("question_type").notNull(),
  options: jsonb("options").$type<Array<{ text: string }>>().notNull().default([]),
  correctAnswers: jsonb("correct_answers").$type<string[]>().notNull().default([]),
  points: integer("points").notNull().default(10),
  explanation: text("explanation"),
  displayOrder: integer("display_order").notNull().default(0),
})

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: text("id").primaryKey(),
    quizId: text("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    answers: jsonb("answers").$type<Record<string, string[]>>().notNull().default({}),
    score: integer("score"),
    maxScore: integer("max_score"),
    passed: boolean("passed"),
    status: text("status").notNull().default("in_progress"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    submittedAt: timestamp("submitted_at"),
    gradedAt: timestamp("graded_at"),
  },
  (table) => [
    uniqueIndex("quiz_attempts_quiz_user_attempt_idx").on(table.quizId, table.userId, table.attemptNumber),
    index("quiz_attempts_user_idx").on(table.userId),
    check(
      "quiz_attempts_status_check",
      sql`${table.status} in ('in_progress', 'submitted', 'pending_review', 'graded', 'expired')`
    ),
  ]
)

export const assignments = pgTable(
  "assignments",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id").references(() => courseLessons.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    instructions: text("instructions"),
    maxScore: integer("max_score").notNull().default(100),
    dueDate: timestamp("due_date"),
    allowLateSubmission: boolean("allow_late_submission").notNull().default(false),
    lateSubmissionPenalty: integer("late_submission_penalty").notNull().default(0),
    allowedFileTypes: jsonb("allowed_file_types").$type<string[]>().notNull().default([]),
    maxFileSize: integer("max_file_size"),
    maxFiles: integer("max_files").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [index("assignments_course_idx").on(table.courseId)]
)

/** Resubmission rule: overwrite allowed while draft/submitted; once
 *  graded, a new submission is rejected unless the instructor first
 *  PATCHes status back to `returned` (see assignments.service.ts's
 *  submitAssignment()). No version-history table. */
export const assignmentSubmissions = pgTable(
  "assignment_submissions",
  {
    id: text("id").primaryKey(),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    content: text("content"),
    attachments: jsonb("attachments")
      .$type<Array<{ uploadId: string; url: string; name: string; size: number; mimeType: string }>>()
      .notNull()
      .default([]),
    status: text("status").notNull().default("submitted"),
    score: integer("score"),
    feedback: text("feedback"),
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
    gradedAt: timestamp("graded_at"),
    isLate: boolean("is_late").notNull().default(false),
  },
  (table) => [
    uniqueIndex("assignment_submissions_assignment_user_idx").on(table.assignmentId, table.userId),
    index("assignment_submissions_user_idx").on(table.userId),
    check("assignment_submissions_status_check", sql`${table.status} in ('draft', 'submitted', 'graded', 'returned')`),
  ]
)

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("audit_log_created_at_idx").on(table.createdAt)]
)

/** One in-app notification row per recipient per business moment
 *  (selection result, payment confirmed, graded, certificate issued) —
 *  written by lib/notify.ts, which also fires the matching transactional
 *  email and never lets a notification failure break the action. */
export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("notifications_user_created_idx").on(table.userId, table.createdAt)]
)

/** Course-scoped announcement authored by a course manager; publishing
 *  fans out a notification to every active participant (see the
 *  announcements module). */
export const announcements = pgTable(
  "announcements",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    createdById: text("created_by_id").notNull(),
    isPublished: boolean("is_published").notNull().default(false),
    publishedAt: timestamp("published_at"),
    isPinned: boolean("is_pinned").notNull().default(false),
    priority: text("priority").notNull().default("normal"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("announcements_course_idx").on(table.courseId)]
)

/** Platform-wide operational settings — a single row (id "global"),
 *  seeded on first read. Admin-managed; updates are audit-logged. */
export const platformSettings = pgTable("platform_settings", {
  id: text("id").primaryKey(),
  platformName: text("platform_name").notNull().default("Solo Kerja"),
  supportEmail: text("support_email").notNull(),
  supportPhone: text("support_phone"),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  allowInstitutionRequests: boolean("allow_institution_requests").notNull().default(true),
  certificateValidityMonths: integer("certificate_validity_months").notNull().default(24),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})
