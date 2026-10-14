import type {
  Enrollment,
  EnrollmentCreate,
  EnrollmentUpdate,
  ParticipantProfile,
  ParticipantProfileUpdate,
} from "@workspace/contracts"
import { and, desc, eq, inArray, isNull, notInArray, or, sql } from "drizzle-orm"
import { db, type Tx } from "../../../db/index.js"
import {
  assignmentSubmissions,
  assignments,
  certificates,
  courseLessons,
  courseModules,
  courses,
  enrollments,
  lessonProgress,
  participantProfiles,
  quizAttempts,
  quizzes,
} from "../../../db/app-schema.js"
import { users as userTable } from "../../../db/auth-schema.js"
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../../lib/errors.js"
import { decryptPii, encryptPii, maskPii } from "../../../lib/pii.js"
import { generateId } from "../../../lib/response.js"
import { issueCertificate } from "../../certificates/services/certificates.service.js"
import { visibleCourseScope } from "../../courses/services/courses.service.js"
import { orderByClause } from "../../../lib/order.js"

/** Per-course lesson totals and per-(user, course) completion counts for
 *  many enrollment rows at once — a handful of grouped queries total,
 *  instead of two (or worse) per enrollment. Backs both list variants'
 *  progress math, including the quiz/assignment completion counts (a
 *  quiz counts once the learner has a submitted/graded attempt; an
 *  assignment counts once any submission exists). */
async function loadLessonStats(rows: { userId: string; courseId: string }[]) {
  const courseIds = [...new Set(rows.map((r) => r.courseId))]
  const userIds = [...new Set(rows.map((r) => r.userId))]

  const totalsByCourse = new Map<string, number>()
  if (courseIds.length > 0) {
    const moduleRows = await db
      .select({ id: courseModules.id, courseId: courseModules.courseId })
      .from(courseModules)
      .where(inArray(courseModules.courseId, courseIds))
    const lessonsByModule = await db
      .select({ moduleId: courseLessons.moduleId, count: sql<number>`count(*)::int` })
      .from(courseLessons)
      .where(
        moduleRows.length
          ? inArray(
              courseLessons.moduleId,
              moduleRows.map((m) => m.id)
            )
          : sql`false`
      )
      .groupBy(courseLessons.moduleId)
    const countByModule = new Map(lessonsByModule.map((l) => [l.moduleId, l.count]))
    for (const moduleRow of moduleRows) {
      totalsByCourse.set(
        moduleRow.courseId,
        (totalsByCourse.get(moduleRow.courseId) ?? 0) + (countByModule.get(moduleRow.id) ?? 0)
      )
    }
  }

  const completedByUserCourse = new Map<string, number>()
  const completedQuizzesByUserCourse = new Map<string, number>()
  const completedAssignmentsByUserCourse = new Map<string, number>()
  if (userIds.length > 0 && courseIds.length > 0) {
    const progressRows = await db
      .select({ userId: lessonProgress.userId, courseId: lessonProgress.courseId, count: sql<number>`count(*)::int` })
      .from(lessonProgress)
      .where(and(inArray(lessonProgress.userId, userIds), inArray(lessonProgress.courseId, courseIds)))
      .groupBy(lessonProgress.userId, lessonProgress.courseId)
    for (const p of progressRows) {
      completedByUserCourse.set(`${p.userId}:${p.courseId}`, p.count)
    }

    const quizRows = await db
      .select({
        userId: quizAttempts.userId,
        courseId: quizzes.courseId,
        count: sql<number>`count(distinct ${quizAttempts.quizId})::int`,
      })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
      .where(
        and(
          inArray(quizAttempts.userId, userIds),
          inArray(quizzes.courseId, courseIds),
          inArray(quizAttempts.status, ["submitted", "pending_review", "graded"])
        )
      )
      .groupBy(quizAttempts.userId, quizzes.courseId)
    for (const q of quizRows) {
      completedQuizzesByUserCourse.set(`${q.userId}:${q.courseId}`, q.count)
    }

    const assignmentRows = await db
      .select({
        userId: assignmentSubmissions.userId,
        courseId: assignments.courseId,
        count: sql<number>`count(distinct ${assignmentSubmissions.assignmentId})::int`,
      })
      .from(assignmentSubmissions)
      .innerJoin(assignments, eq(assignments.id, assignmentSubmissions.assignmentId))
      .where(and(inArray(assignmentSubmissions.userId, userIds), inArray(assignments.courseId, courseIds)))
      .groupBy(assignmentSubmissions.userId, assignments.courseId)
    for (const a of assignmentRows) {
      completedAssignmentsByUserCourse.set(`${a.userId}:${a.courseId}`, a.count)
    }
  }

  return {
    totalsByCourse,
    completedByUserCourse,
    completedQuizzesByUserCourse,
    completedAssignmentsByUserCourse,
  }
}

function toEnrollmentFromStats(
  row: typeof enrollments.$inferSelect,
  totalsByCourse: Map<string, number>,
  completedByUserCourse: Map<string, number>,
  extra?: {
    completedQuizzes?: Map<string, number>
    completedAssignments?: Map<string, number>
  }
): Enrollment {
  const totalLessons = totalsByCourse.get(row.courseId) ?? 0
  const completedLessons = completedByUserCourse.get(`${row.userId}:${row.courseId}`) ?? 0
  const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

  return {
    id: row.id,
    userId: row.userId,
    courseId: row.courseId,
    status: row.status as Enrollment["status"],
    enrollmentType: row.enrollmentType as Enrollment["enrollmentType"],
    progress,
    completedLessons,
    completedQuizzes: extra?.completedQuizzes?.get(`${row.userId}:${row.courseId}`) ?? 0,
    completedAssignments: extra?.completedAssignments?.get(`${row.userId}:${row.courseId}`) ?? 0,
    enrolledAt: row.enrolledAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString(),
    interviewedAt: row.interviewedAt?.toISOString(),
    interviewNotes: row.interviewNotes ?? undefined,
    failedAt: row.failedAt?.toISOString(),
    failureReason: (row.failureReason as Enrollment["failureReason"]) ?? undefined,
    failureNotes: row.failureNotes ?? undefined,
    completedAt: row.completedAt?.toISOString(),
    finalGrade: row.finalGrade ?? undefined,
    certificateIssued: row.certificateIssued,
    certificateId: row.certificateId ?? undefined,
  }
}

async function toEnrollment(row: typeof enrollments.$inferSelect): Promise<Enrollment> {
  const stats = await loadLessonStats([row])
  return toEnrollmentFromStats(row, stats.totalsByCourse, stats.completedByUserCourse, {
    completedQuizzes: stats.completedQuizzesByUserCourse,
    completedAssignments: stats.completedAssignmentsByUserCourse,
  })
}

function listConditions(params: { courseId?: string; courseIds?: string[]; userId?: string; status?: string }) {
  return [
    isNull(enrollments.deletedAt),
    params.courseId ? eq(enrollments.courseId, params.courseId) : undefined,
    // An empty institution has no courses, so no enrollment can match —
    // `inArray` with an empty list is a SQL error, and dropping the
    // condition would silently list the whole platform.
    params.courseIds
      ? params.courseIds.length
        ? inArray(enrollments.courseId, params.courseIds)
        : sql`false`
      : undefined,
    params.userId ? eq(enrollments.userId, params.userId) : undefined,
    params.status ? eq(enrollments.status, params.status) : undefined,
  ].filter((c) => c !== undefined)
}

/** Course ids under one institution — the bridge between an
 *  `institutionId` filter and the enrollment rows, which only carry a
 *  courseId. */
export async function listCourseIdsForInstitution(institutionId: string): Promise<string[]> {
  const rows = await db.select({ id: courses.id }).from(courses).where(eq(courses.institutionId, institutionId))
  return rows.map((r) => r.id)
}

async function mapRowsToEnrollments(rows: (typeof enrollments.$inferSelect)[]): Promise<Enrollment[]> {
  const stats = await loadLessonStats(rows)
  return rows.map((row) =>
    toEnrollmentFromStats(row, stats.totalsByCourse, stats.completedByUserCourse, {
      completedQuizzes: stats.completedQuizzesByUserCourse,
      completedAssignments: stats.completedAssignmentsByUserCourse,
    })
  )
}

/** All matching enrollments, batched. Unbounded — internal callers only
 *  (the list route uses listEnrollmentsPaged except where it post-filters
 *  rows in JS). */
export async function listEnrollments(params: {
  courseId?: string
  courseIds?: string[]
  userId?: string
  status?: string
}): Promise<Enrollment[]> {
  const conditions = listConditions(params)
  const rows = await db
    .select()
    .from(enrollments)
    .where(conditions.length ? and(...conditions) : undefined)
  return mapRowsToEnrollments(rows)
}

/** SQL-level LIMIT/OFFSET + COUNT for the platform-wide list route. */
export async function listEnrollmentsPaged(params: {
  courseId?: string
  courseIds?: string[]
  userId?: string
  status?: string
  page: number
  pageSize: number
  orderBy?: string
}): Promise<{ rows: Enrollment[]; totalCount: number }> {
  const conditions = listConditions(params)
  const where = conditions.length ? and(...conditions) : undefined
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(enrollments)
    .where(where)
  const rows = await db
    .select()
    .from(enrollments)
    .where(where)
    .orderBy(orderByClause(params.orderBy, { enrolledAt: enrollments.enrolledAt }, desc(enrollments.enrolledAt)))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize)
  return { rows: await mapRowsToEnrollments(rows), totalCount: countRow?.count ?? 0 }
}

async function getEnrollmentRow(id: string) {
  const [row] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.id, id), isNull(enrollments.deletedAt)))
    .limit(1)
  if (!row) throw new NotFoundError("Enrollment", id)
  return row
}

export async function getEnrollment(id: string): Promise<Enrollment> {
  return toEnrollment(await getEnrollmentRow(id))
}

export async function getEnrollmentCourseId(id: string): Promise<string> {
  return (await getEnrollmentRow(id)).courseId
}

export async function getEnrollmentOwnerId(id: string): Promise<string> {
  return (await getEnrollmentRow(id)).userId
}

export async function getEnrollmentStatus(id: string): Promise<Enrollment["status"]> {
  return (await getEnrollmentRow(id)).status as Enrollment["status"]
}

async function ensureParticipantProfile(userId: string, tx?: Tx): Promise<void> {
  // onConflictDoNothing: two concurrent first-time enrolls both see "no
  // profile" and both insert — the PK (the account id) turns the loser
  // into a no-op instead of a raw pg unique-violation 500.
  await (tx ?? db).insert(participantProfiles).values({ id: userId }).onConflictDoNothing()
}

export async function enroll(
  userId: string,
  input: EnrollmentCreate,
  opts: { managerBypass?: boolean } = {}
): Promise<Enrollment> {
  const inserted = await db.transaction(async (tx) => {
    // FOR UPDATE serializes concurrent enrolls on the same course row, so
    // the quota COUNT below is computed against a stable set — a plain
    // count-then-insert let two simultaneous requests both pass the cap.
    const [course] = await tx.select().from(courses).where(eq(courses.id, input.courseId)).for("update").limit(1)
    if (!course) throw new NotFoundError("Course", input.courseId)

    // Business gates for self-service registration. Course managers bypass
    // the visibility/window checks (instructors enroll into their own drafts
    // to preview), but never the quota — a cap is a cap.
    if (!opts.managerBypass) {
      if (course.status !== "published") {
        throw new ConflictError("This course is not open for registration")
      }
      const now = new Date()
      if (course.registrationOpenAt && now < course.registrationOpenAt) {
        throw new ConflictError("Registration for this course has not opened yet")
      }
      if (course.registrationCloseAt && now > course.registrationCloseAt) {
        throw new ConflictError("Registration for this course is closed")
      }
    }
    if (course.registrantQuota != null) {
      const [row] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.courseId, course.id),
            isNull(enrollments.deletedAt),
            notInArray(enrollments.status, ["canceled", "failed"])
          )
        )
      if ((row?.count ?? 0) >= course.registrantQuota) {
        throw new ConflictError("This course's registration quota is full")
      }
    }

    await ensureParticipantProfile(userId, tx)

    const [existing] = await tx
      .select()
      .from(enrollments)
      .where(
        and(eq(enrollments.userId, userId), eq(enrollments.courseId, input.courseId), isNull(enrollments.deletedAt))
      )
      .limit(1)

    const isFreeOnline = course.courseType === "online"
    const initialStatus = isFreeOnline ? "selected" : "registered"
    const nowTimestamp = new Date()

    if (existing) {
      if (existing.status === "canceled" || existing.status === "failed") {
        const [reopened] = await tx
          .update(enrollments)
          .set({
            status: initialStatus,
            enrollmentType: input.enrollmentType ?? "free",
            enrolledAt: nowTimestamp,
            approvedAt: isFreeOnline ? nowTimestamp : null,
            interviewedAt: null,
            interviewNotes: null,
            failedAt: null,
            failureReason: null,
            failureNotes: null,
            completedAt: null,
            finalGrade: null,
          })
          .where(eq(enrollments.id, existing.id))
          .returning()
        return reopened!
      }
      throw new ConflictError("You are already enrolled in this course")
    }

    const [row] = await tx
      .insert(enrollments)
      .values({
        id: generateId("enr"),
        userId,
        courseId: input.courseId,
        status: initialStatus,
        approvedAt: isFreeOnline ? nowTimestamp : null,
        enrollmentType: input.enrollmentType ?? "free",
      })
      .onConflictDoNothing()
      .returning()
    if (!row) throw new ConflictError("You are already enrolled in this course")
    return row
  })
  return toEnrollment(inserted)
}

const STATUS_TIMESTAMP_FIELD: Partial<Record<Enrollment["status"], string>> = {
  interviewed: "interviewedAt",
  selected: "approvedAt",
  failed: "failedAt",
  graduated: "completedAt",
}

/** The funnel's legal status transitions. Graduation is terminal (a
 *  certificate is a permanent record); failed/canceled applicants can be
 *  re-queued to `registered` by a manager; self-status is always allowed
 *  so idempotent re-submits (e.g. re-graduating for the certificate
 *  backfill) stay no-ops rather than 409s. */
export const ALLOWED_TRANSITIONS: Record<Enrollment["status"], Enrollment["status"][]> = {
  registered: ["registered", "interviewed", "selected", "failed", "canceled"],
  interviewed: ["interviewed", "registered", "selected", "failed", "canceled"],
  selected: ["selected", "graduated", "failed", "canceled"],
  graduated: ["graduated"],
  failed: ["failed", "registered"],
  canceled: ["canceled", "registered"],
}

export async function updateEnrollment(id: string, input: EnrollmentUpdate): Promise<Enrollment> {
  const current = await getEnrollmentRow(id)

  if (input.finalGrade !== undefined && (input.finalGrade < 0 || input.finalGrade > 100)) {
    throw new BadRequestError("finalGrade must be between 0 and 100")
  }

  const target = input.status
  if (!ALLOWED_TRANSITIONS[current.status as Enrollment["status"]]?.includes(target)) {
    throw new ConflictError(`Cannot change enrollment status from '${current.status}' to '${target}'`)
  }

  const timestampField = STATUS_TIMESTAMP_FIELD[target]
  const patch: Record<string, unknown> = { status: target }
  if (timestampField === "interviewedAt") {
    patch.interviewedAt = new Date()
    patch.interviewNotes = input.interviewNotes
  } else if (timestampField === "approvedAt") {
    patch.approvedAt = new Date()
  } else if (timestampField === "failedAt") {
    patch.failedAt = new Date()
    patch.failureReason = input.failureReason
    patch.failureNotes = input.failureNotes
  } else if (timestampField === "completedAt") {
    patch.completedAt = new Date()
    patch.finalGrade = input.finalGrade
  }

  // Graduation is atomic: the status transition and the auto-issued
  // certificate commit together or not at all. Selecting an applicant
  // consumes a participant slot, so it locks the course row first (same
  // race the enroll quota guards against).
  if (target === "graduated" || target === "selected") {
    return db.transaction(async (tx) => {
      if (target === "selected") {
        const [course] = await tx
          .select({ participantQuota: courses.participantQuota })
          .from(courses)
          .where(eq(courses.id, current.courseId))
          .for("update")
          .limit(1)
        if (course?.participantQuota != null) {
          const [row] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(enrollments)
            .where(
              and(
                eq(enrollments.courseId, current.courseId),
                inArray(enrollments.status, ["selected", "graduated"]),
                notInArray(enrollments.id, [id])
              )
            )
          if ((row?.count ?? 0) >= course.participantQuota) {
            throw new ConflictError("This course's participant quota is full")
          }
        }
      }
      const [row] = await tx.update(enrollments).set(patch).where(eq(enrollments.id, id)).returning()
      if (target === "graduated") {
        await issueCertificate(row!.courseId, { enrollmentId: row!.id }, tx)
      }
      const [refreshed] = await tx.select().from(enrollments).where(eq(enrollments.id, id)).limit(1)
      return toEnrollment(refreshed!)
    })
  }

  const [row] = await db.update(enrollments).set(patch).where(eq(enrollments.id, id)).returning()
  return toEnrollment(row!)
}

function toParticipantProfile(
  row: typeof participantProfiles.$inferSelect,
  account: { name: string; email: string },
  /** Only the profile's own account reads the identity numbers in full. */
  unmasked: boolean
): ParticipantProfile {
  const identity = (stored: string | null) => {
    const plain = decryptPii(stored)
    return unmasked ? plain : maskPii(plain)
  }
  return {
    id: row.id,
    name: account.name,
    email: account.email,
    phone: row.phone ?? undefined,
    profession: row.profession ?? undefined,
    institutionName: row.institutionName ?? undefined,
    strNumber: row.strNumber ?? undefined,
    about: row.about ?? undefined,
    educationLevel: row.educationLevel ?? undefined,
    address: row.address ?? undefined,
    residentialAddress: row.residentialAddress ?? undefined,
    dati2: row.dati2 ?? undefined,
    gender: (row.gender as ParticipantProfile["gender"]) ?? undefined,
    nationality: row.nationality ?? undefined,
    religion: row.religion ?? undefined,
    maritalStatus: row.maritalStatus ?? undefined,
    birthDate: row.birthDate ?? undefined,
    // Identity numbers are stored encrypted at rest when PII_ENCRYPTION_KEY
    // is set — decrypted transparently here, then masked for every reader
    // but the owner (see lib/pii.ts).
    ktpNumber: identity(row.ktpNumber),
    bpjsKesehatanNumber: identity(row.bpjsKesehatanNumber),
    education: row.education as ParticipantProfile["education"],
    experience: row.experience as ParticipantProfile["experience"],
    certifications: row.certifications as ParticipantProfile["certifications"],
  }
}

/**
 * Profiles for a whole roster page in one call. The per-id access rule
 * matches getParticipantProfile's, but resolved in bulk: one query pairs
 * the requested users against the courses this caller manages, instead
 * of walking each user's enrollments and asking per course. Ids the
 * caller may not read are dropped, so one stranger in the list cannot
 * fail the page.
 */
export async function listParticipantProfiles(
  userIds: string[],
  viewer: { id: string; role?: string | null; email?: string | null }
): Promise<ParticipantProfile[]> {
  const ids = [...new Set(userIds)].filter(Boolean)
  if (ids.length === 0) return []

  let allowed: Set<string>
  if (viewer.role === "admin") {
    allowed = new Set(ids)
  } else {
    const scope = await visibleCourseScope(viewer)
    const reach = [
      scope.ownedInstitutionIds.length ? inArray(courses.institutionId, scope.ownedInstitutionIds) : undefined,
      scope.instructedCourseIds.length ? inArray(courses.id, scope.instructedCourseIds) : undefined,
    ].filter((c) => c !== undefined)
    // No managed courses at all: the caller can still read their own row,
    // and an `or()` of nothing would match everything.
    const managed = reach.length
      ? await db
          .selectDistinct({ userId: enrollments.userId })
          .from(enrollments)
          .innerJoin(courses, eq(courses.id, enrollments.courseId))
          .where(and(inArray(enrollments.userId, ids), or(...reach)))
      : []
    allowed = new Set(managed.map((r) => r.userId))
    if (ids.includes(viewer.id)) allowed.add(viewer.id)
  }
  const visible = ids.filter((id) => allowed.has(id))
  if (visible.length === 0) return []

  const [accounts, profileRows] = await Promise.all([
    db
      .select({ id: userTable.id, name: userTable.name, email: userTable.email })
      .from(userTable)
      .where(inArray(userTable.id, visible)),
    db.select().from(participantProfiles).where(inArray(participantProfiles.id, visible)),
  ])
  const profileById = new Map(profileRows.map((row) => [row.id, row]))

  return accounts.map((account) =>
    toParticipantProfile(profileById.get(account.id) ?? emptyProfileRow(account.id), account, account.id === viewer.id)
  )
}

/** The shape getParticipantProfile falls back to for an account that has
 *  never enrolled — a real account with nothing filled in, not a 404. */
function emptyProfileRow(userId: string): typeof participantProfiles.$inferSelect {
  return {
    id: userId,
    phone: null,
    profession: null,
    institutionName: null,
    strNumber: null,
    about: null,
    educationLevel: null,
    address: null,
    residentialAddress: null,
    dati2: null,
    gender: null,
    nationality: null,
    religion: null,
    maritalStatus: null,
    birthDate: null,
    ktpNumber: null,
    bpjsKesehatanNumber: null,
    education: [],
    experience: [],
    certifications: [],
  }
}

export async function getParticipantProfile(userId: string, unmasked = false): Promise<ParticipantProfile> {
  const [account] = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1)
  if (!account) throw new NotFoundError("ParticipantProfile", userId)

  const [profile] = await db.select().from(participantProfiles).where(eq(participantProfiles.id, userId)).limit(1)
  if (profile) return toParticipantProfile(profile, account, unmasked)

  // No profile row yet (never enrolled) — return an empty-but-valid shape
  // rather than 404ing, since the account itself is real.
  return toParticipantProfile(emptyProfileRow(userId), account, unmasked)
}

/** Self-service profile update — own row only (the route enforces the
 *  id match). `null` clears a stored field, `undefined` leaves it alone;
 *  the PII identity numbers encrypt at rest when the key is configured.
 *  Upserts so a first edit before any enrollment still works. */
export async function updateParticipantProfile(
  userId: string,
  input: ParticipantProfileUpdate
): Promise<ParticipantProfile> {
  const patch: Record<string, unknown> = {}
  const textFields = [
    "phone",
    "profession",
    "institutionName",
    "strNumber",
    "about",
    "educationLevel",
    "address",
    "residentialAddress",
    "dati2",
    "gender",
    "nationality",
    "religion",
    "maritalStatus",
  ] as const
  for (const field of textFields) {
    const value = input[field]
    if (value !== undefined) patch[field] = value
  }
  if (input.birthDate !== undefined) patch.birthDate = input.birthDate // plainDate string or null
  for (const field of ["ktpNumber", "bpjsKesehatanNumber"] as const) {
    const value = input[field]
    if (value !== undefined) patch[field] = value === null || value === "" ? null : encryptPii(value)
  }
  for (const field of ["education", "experience", "certifications"] as const) {
    const value = input[field]
    if (value !== undefined) patch[field] = value
  }

  await db
    .insert(participantProfiles)
    .values({ id: userId, ...patch })
    .onConflictDoUpdate({ target: participantProfiles.id, set: patch })
  // The caller is the owner by construction here, so it reads back its
  // own write in full rather than the masked form.
  return getParticipantProfile(userId, true)
}

export async function deleteEnrollment(id: string): Promise<void> {
  const row = await getEnrollmentRow(id)
  // An issued certificate is a permanent business record (it has a public
  // verification code). Deleting its enrollment would cascade-destroy it.
  if (row.certificateIssued) {
    const [cert] = await db
      .select({ id: certificates.id })
      .from(certificates)
      .where(eq(certificates.enrollmentId, id))
      .limit(1)
    if (cert) throw new ConflictError("This enrollment has an issued certificate and cannot be deleted")
  }
  await db.update(enrollments).set({ deletedAt: new Date(), status: "canceled" }).where(eq(enrollments.id, id))
}

/** Aggregated enrollment counts per course, one grouped query — backs the
 *  course-facing registrantCount/participantCount fields so they are
 *  always live instead of maintained (and drifting) counters. */
export async function loadEnrollmentCountsBatch(
  courseIds: string[]
): Promise<Map<string, { registrants: number; participants: number }>> {
  if (courseIds.length === 0) return new Map()
  const rows = await db
    .select({
      courseId: enrollments.courseId,
      registrants: sql<number>`count(*) filter (where ${enrollments.status} <> 'canceled' and ${enrollments.status} <> 'failed')::int`,
      participants: sql<number>`count(*) filter (where ${enrollments.status} = 'selected' or ${enrollments.status} = 'graduated')::int`,
    })
    .from(enrollments)
    .where(and(inArray(enrollments.courseId, courseIds), isNull(enrollments.deletedAt)))
    .groupBy(enrollments.courseId)
  return new Map(rows.map((r) => [r.courseId, { registrants: r.registrants, participants: r.participants }]))
}

/** Guard for the two self-service actions (self-enroll, cancel-own): the
 *  acting user must own the enrollment. Admins/course managers use
 *  updateEnrollment via the broader assertCanManageCourse gate instead. */
export async function assertOwnsEnrollment(userId: string, enrollmentId: string) {
  const owner = await getEnrollmentOwnerId(enrollmentId)
  if (owner !== userId) throw new ForbiddenError("You do not own this enrollment")
}
