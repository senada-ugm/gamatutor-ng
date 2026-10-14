import type {
  CourseInstructor,
  CourseInstructorCreate,
  CourseInstructorRoleUpdate,
  CourseInstructorUser,
} from "@workspace/contracts"
import { and, eq, inArray, or } from "drizzle-orm"
import { db } from "../../../db/index.js"
import { courseInstructors, courses } from "../../../db/app-schema.js"
import { users as userTable } from "../../../db/auth-schema.js"
import { ConflictError, NotFoundError } from "../../../lib/errors.js"
import { generateId } from "../../../lib/response.js"

async function resolveUser(email: string): Promise<CourseInstructorUser> {
  const [account] = await db.select().from(userTable).where(eq(userTable.email, email)).limit(1)
  if (account) return { id: account.id, name: account.name, email: account.email }
  return { id: "", name: email.split("@")[0] ?? email, email }
}

async function toCourseInstructor(row: typeof courseInstructors.$inferSelect): Promise<CourseInstructor> {
  const user = await resolveUser(row.email)
  // An invite accepted before the invitee had an account backfills its
  // userId + flips to active the moment a matching account shows up.
  const status = row.status === "pending" && user.id ? "active" : row.status
  if (status !== row.status) {
    await db.update(courseInstructors).set({ userId: user.id, status }).where(eq(courseInstructors.id, row.id))
  }
  return {
    id: row.id,
    courseId: row.courseId,
    email: row.email,
    status: status as CourseInstructor["status"],
    role: row.role as CourseInstructor["role"],
    createdAt: row.createdAt.toISOString(),
    user,
  }
}

export async function listCourseInstructors(courseId: string): Promise<CourseInstructor[]> {
  const rows = await db.select().from(courseInstructors).where(eq(courseInstructors.courseId, courseId))
  return Promise.all(rows.map(toCourseInstructor))
}

/** The caller's own ACTIVE assignments across every course — matched by
 *  userId or by email (an invite accepted before the invitee had an
 *  account), same rule course-access.ts's getCourseInstructorRole uses. */
export async function listMyAssignments(user: { id: string; email?: string | null }): Promise<CourseInstructor[]> {
  const conditions = [eq(courseInstructors.userId, user.id)]
  if (user.email) conditions.push(eq(courseInstructors.email, user.email))
  const rows = await db
    .select()
    .from(courseInstructors)
    .where(and(eq(courseInstructors.status, "active"), or(...conditions)))
  return Promise.all(rows.map(toCourseInstructor))
}

export async function getCourseInstructorCourseId(id: string): Promise<string> {
  const [row] = await db.select().from(courseInstructors).where(eq(courseInstructors.id, id)).limit(1)
  if (!row) throw new NotFoundError("CourseInstructor", id)
  return row.courseId
}

/** Instructors already teaching at least one OTHER course in this
 *  institution, deduped by email, excluding anyone already on
 *  excludeCourseId. */
export async function getInstitutionInstructorRoster(
  institutionId: string,
  excludeCourseId?: string
): Promise<CourseInstructorUser[]> {
  const institutionCourses = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.institutionId, institutionId))
  const institutionCourseIds = institutionCourses.map((c) => c.id)
  if (institutionCourseIds.length === 0) return []

  const rows = await db
    .select()
    .from(courseInstructors)
    .where(inArray(courseInstructors.courseId, institutionCourseIds))

  const excludedEmails = new Set(rows.filter((r) => r.courseId === excludeCourseId).map((r) => r.email.toLowerCase()))

  const roster = new Map<string, CourseInstructorUser>()
  for (const row of rows) {
    const email = row.email.toLowerCase()
    if (excludedEmails.has(email)) continue
    if (!roster.has(email)) roster.set(email, await resolveUser(row.email))
  }
  return [...roster.values()]
}

export async function createCourseInstructor(input: CourseInstructorCreate): Promise<CourseInstructor> {
  const [existing] = await db
    .select()
    .from(courseInstructors)
    .where(and(eq(courseInstructors.courseId, input.courseId), eq(courseInstructors.email, input.email)))
    .limit(1)
  if (existing) throw new ConflictError("This email is already an instructor on this course")

  const user = await resolveUser(input.email)
  const [row] = await db
    .insert(courseInstructors)
    .values({
      id: generateId("ci"),
      courseId: input.courseId,
      email: input.email,
      userId: user.id || null,
      role: input.role ?? "instructor",
      status: user.id ? "active" : "pending",
    })
    .returning()
  return toCourseInstructor(row!)
}

export async function updateCourseInstructorRole(
  id: string,
  input: CourseInstructorRoleUpdate
): Promise<CourseInstructor> {
  const [row] = await db
    .update(courseInstructors)
    .set({ role: input.role })
    .where(eq(courseInstructors.id, id))
    .returning()
  if (!row) throw new NotFoundError("CourseInstructor", id)
  return toCourseInstructor(row)
}

export async function removeCourseInstructor(id: string): Promise<void> {
  const [row] = await db.select().from(courseInstructors).where(eq(courseInstructors.id, id)).limit(1)
  if (!row) throw new NotFoundError("CourseInstructor", id)
  await db.delete(courseInstructors).where(eq(courseInstructors.id, id))
}
