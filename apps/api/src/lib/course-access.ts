import { and, eq } from "drizzle-orm"
import { db } from "../db/index.js"
import { courseInstructors, courses, enrollments, institutionOwnerships } from "../db/app-schema.js"
import { ForbiddenError, NotFoundError } from "./errors.js"

type ActingUser = { id: string; role?: string | null; email?: string | null }

/** Admins manage any institution; everyone else must hold an ownership
 *  grant on it — same rule institutions.tsp's admin-only create op and
 *  the owner workspace pages already assume. Moved here from
 *  courses.service.ts so every course-scoped domain module can share it. */
export async function assertCanManageInstitution(user: ActingUser, institutionId: string) {
  if (user.role === "admin") return
  const [ownership] = await db
    .select()
    .from(institutionOwnerships)
    .where(and(eq(institutionOwnerships.userId, user.id), eq(institutionOwnerships.institutionId, institutionId)))
    .limit(1)
  if (!ownership) throw new ForbiddenError("You do not manage this institution")
}

/** Active course-instructor role for this user on this course, matched by
 *  userId (once resolved) or by email (an invite accepted before the
 *  invitee had an account). Returns null if course_instructors has no
 *  matching active row. */
export async function getCourseInstructorRole(
  courseId: string,
  user: ActingUser
): Promise<"instructor" | "co_instructor" | null> {
  const rows = await db
    .select()
    .from(courseInstructors)
    .where(and(eq(courseInstructors.courseId, courseId), eq(courseInstructors.status, "active")))
  const match = rows.find((r) => r.userId === user.id || (user.email && r.email === user.email))
  return match ? (match.role as "instructor" | "co_instructor") : null
}

async function getCourseInstitutionId(courseId: string): Promise<string> {
  const [row] = await db
    .select({ institutionId: courses.institutionId })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1)
  if (!row) throw new NotFoundError("Course", courseId)
  return row.institutionId
}

/** Broad "can manage this course" check: admin, institution owner, or an
 *  active course-instructor. Used by content/quiz/assignment/
 *  certificate/discussion-moderation routes across every course-scoped
 *  module. */
export async function assertCanManageCourse(user: ActingUser, courseId: string) {
  if (user.role === "admin") return
  const institutionId = await getCourseInstitutionId(courseId)
  const [ownership] = await db
    .select()
    .from(institutionOwnerships)
    .where(and(eq(institutionOwnerships.userId, user.id), eq(institutionOwnerships.institutionId, institutionId)))
    .limit(1)
  if (ownership) return
  const role = await getCourseInstructorRole(courseId, user)
  if (!role) throw new ForbiddenError("You do not manage this course")
}

/** Narrow "can manage this course's instructor roster" check: admin or
 *  institution owner only — mirrors the pre-existing mock
 *  canManageCourseInstructors() gate. Course-instructors themselves cannot
 *  invite/remove other instructors. */
export async function assertCanManageCourseInstructors(user: ActingUser, courseId: string) {
  const institutionId = await getCourseInstitutionId(courseId)
  await assertCanManageInstitution(user, institutionId)
}

/** The statuses that make an enrollment an active *participant* — the
 *  funnel's participant stage. A mere `registered` applicant has applied
 *  but hasn't been selected yet, so content/quiz/assignment access
 *  waits for selection. */
const PARTICIPANT_STATUSES = ["selected", "graduated"] as const

/** Non-throwing variant of assertCanManageCourse for visibility decisions
 *  (public course detail, catalog scope) rather than permission denials. */
export async function isCourseManager(user: ActingUser, courseId: string): Promise<boolean> {
  if (user.role === "admin") return true
  try {
    await assertCanManageCourse(user, courseId)
    return true
  } catch {
    return false
  }
}

/** True when userId holds a selected/graduated enrollment in this course —
 *  the non-throwing counterpart of assertIsEnrolledParticipant's
 *  enrollment branch (managers are checked separately by callers). */
export async function isActiveParticipant(userId: string, courseId: string): Promise<boolean> {
  const [enrollment] = await db
    .select({ status: enrollments.status })
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
    .limit(1)
  return !!enrollment && (PARTICIPANT_STATUSES as readonly string[]).includes(enrollment.status)
}

/** Requires the caller to hold a non-canceled/failed enrollment in this
 *  course — the gate for every student-facing CoursePlayer mutation
 *  (lesson-progress, quiz attempts, assignment submission). Admins and
 *  course managers bypass this (an instructor
 *  previewing their own course isn't "enrolled"). Only a selected or
 *  graduated enrollment counts: a `registered` applicant hasn't entered
 *  the course yet. */
export async function assertIsEnrolledParticipant(user: ActingUser, courseId: string) {
  if (user.role === "admin") return
  const institutionId = await getCourseInstitutionId(courseId)
  const [ownership] = await db
    .select()
    .from(institutionOwnerships)
    .where(and(eq(institutionOwnerships.userId, user.id), eq(institutionOwnerships.institutionId, institutionId)))
    .limit(1)
  if (ownership) return
  const role = await getCourseInstructorRole(courseId, user)
  if (role) return

  const [enrollment] = await db
    .select({ status: enrollments.status })
    .from(enrollments)
    .where(and(eq(enrollments.userId, user.id), eq(enrollments.courseId, courseId)))
    .limit(1)
  if (!enrollment || !(PARTICIPANT_STATUSES as readonly string[]).includes(enrollment.status)) {
    throw new ForbiddenError("You are not an active participant in this course")
  }
}

/** Read gate for a course-scoped list/detail a learner consumes inside
 *  CoursePlayer (quizzes, assignments, discussions):
 *  course managers and active participants only — not "any signed-in
 *  account", which would leak draft-course material to outsiders. */
export async function assertCanAccessCourse(user: ActingUser, courseId: string) {
  if (await isCourseManager(user, courseId)) return
  await assertIsEnrolledParticipant(user, courseId)
}

/** Standalone (course-less) quizzes are platform-wide assessments, not
 *  scoped to an institution - only admins author them. */
export async function assertCanManageAssessment(user: ActingUser) {
  if (user.role !== "admin") throw new ForbiddenError("You do not manage assessments")
}

/** Any signed-in user may attempt an assessment - there is no enrollment
 *  concept for a course-less quiz. Session presence is already enforced
 *  by requireSession before this is called; this exists only so call
 *  sites read symmetrically with assertIsEnrolledParticipant. */
export async function assertCanAttemptAssessment(): Promise<void> {}
