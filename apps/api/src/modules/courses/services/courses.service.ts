import type { Course, CourseCreate, CourseUpdate, Module } from "@workspace/contracts"
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm"
import { db } from "../../../db/index.js"
import { courseInstructors, courses, institutionOwnerships } from "../../../db/app-schema.js"
import { assertCanManageInstitution } from "../../../lib/course-access.js"
import { NotFoundError } from "../../../lib/errors.js"
import { generateId } from "../../../lib/response.js"
import { ilikeContains } from "../../../lib/search.js"
import { orderByClause } from "../../../lib/order.js"
import { composeModules, composeModulesBatch } from "../../course-content/services/course-content.service.js"
import { loadEnrollmentCountsBatch } from "../../enrollments/services/enrollments.service.js"
import { loadInstitutionsBatch } from "../../institutions/services/institutions.service.js"
import { claimUpload, extractUploadIdFromUrl, releaseUpload } from "../../uploads/services/uploads.service.js"

export { assertCanManageInstitution }

/** Syllabus entries for a non-participant viewer: structure stays, but the
 *  actual material (textContent/url) is only served for lessons the author
 *  explicitly marked as free preview. */
function stripToPreview(module: Module): Module {
  return {
    ...module,
    lessons: module.lessons.map((lesson) =>
      lesson.isPreview ? lesson : { ...lesson, textContent: undefined, url: undefined }
    ),
  }
}

async function toCourse(
  row: typeof courses.$inferSelect,
  opts: {
    modules?: Module[]
    counts?: { registrants: number; participants: number }
    institution?: Course["institution"]
    previewOnly?: boolean
  } = {}
): Promise<Course> {
  const moduleTree = opts.modules ?? (await composeModules(row.id))
  const institution = opts.institution ??
    (await loadInstitutionsBatch([row.institutionId])).get(row.institutionId) ?? {
      id: row.institutionId,
      name: "Institusi",
      logo: null,
    }
  const counts = opts.counts
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortDescription: row.shortDescription ?? undefined,
    description: row.description ?? undefined,
    thumbnail: row.thumbnail,
    courseType: row.courseType as Course["courseType"],
    location: row.location ?? undefined,
    scheduledAt: row.scheduledAt?.toISOString(),
    scheduledEndAt: row.scheduledEndAt?.toISOString(),
    registrationOpenAt: row.registrationOpenAt?.toISOString(),
    registrationCloseAt: row.registrationCloseAt?.toISOString(),
    registrantQuota: row.registrantQuota ?? undefined,
    participantQuota: row.participantQuota ?? undefined,
    // live aggregate, not a stored counter — computed per read so it
    // can never drift from the enrollments table
    registrantCount: counts?.registrants ?? 0,
    participantCount: counts?.participants ?? 0,
    level: row.level as Course["level"],
    language: row.language,
    trainingType: (row.trainingType as Course["trainingType"]) ?? undefined,
    customTrainingType: row.customTrainingType ?? undefined,
    isDisabilityFriendly: row.isDisabilityFriendly,
    supportedDisabilityTypes: row.supportedDisabilityTypes,
    minimumEducation: row.minimumEducation ?? undefined,
    minimumAge: row.minimumAge ?? undefined,
    maximumAge: row.maximumAge ?? undefined,
    cityCode: row.cityCode ?? undefined,
    fundingSource: (row.fundingSource as Course["fundingSource"]) ?? undefined,
    customFundingSource: row.customFundingSource ?? undefined,
    trainingBudget: row.trainingBudget ?? undefined,
    contactPersonName: row.contactPersonName ?? undefined,
    contactPersonPhone: row.contactPersonPhone ?? undefined,
    status: row.status as Course["status"],
    institutionId: row.institutionId,
    institution,
    instructor: row.instructor,
    modules: opts.previewOnly ? moduleTree.map(stripToPreview) : moduleTree,
    updatedAt: row.updatedAt.toISOString(),
    price: row.price ?? undefined,
  }
}

/** The non-public courses a non-admin caller may still see in the
 *  catalog/list: everything published (enforced separately) plus drafts of
 *  institutions they own and courses they actively teach. Two cheap
 *  per-user queries — the list route folds the result into its WHERE so
 *  SQL pagination and COUNT stay correct. */
export async function visibleCourseScope(user: { id: string; email?: string | null }): Promise<{
  ownedInstitutionIds: string[]
  instructedCourseIds: string[]
}> {
  const ownershipRows = await db
    .select({ institutionId: institutionOwnerships.institutionId })
    .from(institutionOwnerships)
    .where(eq(institutionOwnerships.userId, user.id))
  const instructorConditions = [eq(courseInstructors.userId, user.id)]
  if (user.email) instructorConditions.push(eq(courseInstructors.email, user.email))
  const instructorRows = await db
    .select({ courseId: courseInstructors.courseId })
    .from(courseInstructors)
    .where(and(eq(courseInstructors.status, "active"), or(...instructorConditions)))
  return {
    ownedInstitutionIds: [...new Set(ownershipRows.map((r) => r.institutionId))],
    instructedCourseIds: [...new Set(instructorRows.map((r) => r.courseId))],
  }
}

/** SQL-level LIMIT/OFFSET + COUNT for the catalog route, with each
 *  page's module trees composed in two batched queries instead of two
 *  per course. `visibility` carries the caller's non-published scope —
 *  admins pass nothing. */
export async function listCourses(params: {
  institutionId?: string
  status?: string
  search?: string
  orderBy?: string
  page: number
  pageSize: number
  visibility?: SQL
}): Promise<{ rows: Course[]; totalCount: number }> {
  const conditions = [
    params.institutionId ? eq(courses.institutionId, params.institutionId) : undefined,
    params.status ? eq(courses.status, params.status) : undefined,
    params.search
      ? or(
          ilike(courses.title, ilikeContains(params.search)),
          ilike(courses.shortDescription, ilikeContains(params.search))
        )
      : undefined,
    params.visibility,
  ].filter((c): c is SQL => c !== undefined)
  const where = conditions.length ? and(...conditions) : undefined

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(courses)
    .where(where)
  const rows = await db
    .select()
    .from(courses)
    .where(where)
    .orderBy(
      orderByClause(params.orderBy, { createdAt: courses.createdAt, title: courses.title }, desc(courses.createdAt))
    )
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize)

  const [modulesByCourse, countsByCourse, institutionsById] = await Promise.all([
    composeModulesBatch(rows.map((r) => r.id)),
    loadEnrollmentCountsBatch(rows.map((r) => r.id)),
    loadInstitutionsBatch(rows.map((r) => r.institutionId)),
  ])
  return {
    rows: await Promise.all(
      rows.map((r) =>
        toCourse(r, {
          modules: modulesByCourse.get(r.id) ?? [],
          counts: countsByCourse.get(r.id),
          institution: institutionsById.get(r.institutionId),
        })
      )
    ),
    totalCount: countRow?.count ?? 0,
  }
}

/** Slug is server-generated from the title — not collected by CourseForm.
 *  Appending a short random suffix sidesteps collision handling entirely
 *  rather than adding a check-and-retry loop for a mockup-scale need. */
function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${base || "course"}-${suffix}`
}

export async function getCourseRow(id: string): Promise<typeof courses.$inferSelect> {
  const [row] = await db
    .select()
    .from(courses)
    .where(or(eq(courses.id, id), eq(courses.slug, id)))
    .limit(1)
  if (!row) throw new NotFoundError("Course", id)
  return row
}

export async function getCourse(id: string, opts: { previewOnly?: boolean } = {}): Promise<Course> {
  const row = await getCourseRow(id)
  const counts = (await loadEnrollmentCountsBatch([row.id])).get(row.id)
  return toCourse(row, { counts, previewOnly: opts.previewOnly })
}

export async function createCourse(
  input: CourseCreate,
  actingUser: { id: string; name: string; image?: string | null; role?: string | null }
): Promise<Course> {
  await assertCanManageInstitution(actingUser, input.institutionId)

  const [row] = await db
    .insert(courses)
    .values({
      id: generateId("crs"),
      slug: slugify(input.title),
      title: input.title,
      shortDescription: input.shortDescription,
      description: input.description,
      thumbnail: input.thumbnail,
      courseType: input.courseType,
      location: input.location,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      scheduledEndAt: input.scheduledEndAt ? new Date(input.scheduledEndAt) : undefined,
      registrationOpenAt: input.registrationOpenAt ? new Date(input.registrationOpenAt) : undefined,
      registrationCloseAt: input.registrationCloseAt ? new Date(input.registrationCloseAt) : undefined,
      registrantQuota: input.registrantQuota,
      participantQuota: input.participantQuota,
      level: input.level ?? "beginner",
      language: input.language ?? "id",
      trainingType: input.trainingType,
      customTrainingType: input.customTrainingType,
      isDisabilityFriendly: input.isDisabilityFriendly,
      supportedDisabilityTypes: input.supportedDisabilityTypes,
      minimumEducation: input.minimumEducation,
      minimumAge: input.minimumAge,
      maximumAge: input.maximumAge,
      cityCode: input.cityCode,
      fundingSource: input.fundingSource,
      customFundingSource: input.customFundingSource,
      trainingBudget: input.trainingBudget,
      contactPersonName: input.contactPersonName,
      contactPersonPhone: input.contactPersonPhone,
      status: "draft",
      institutionId: input.institutionId,
      instructor: { id: actingUser.id, name: actingUser.name, image: actingUser.image ?? null },
      modules: [],
      price: input.price,
    })
    .returning()
  const created = await toCourse(row!)

  const uploadId = extractUploadIdFromUrl(created.thumbnail)
  if (uploadId) await claimUpload(uploadId, "course", created.id)

  return created
}

export async function updateCourse(
  id: string,
  input: CourseUpdate,
  actingUser: { id: string; role?: string | null }
): Promise<Course> {
  const existing = await getCourse(id)
  await assertCanManageInstitution(actingUser, existing.institutionId)

  // One transaction: the row update and the thumbnail claim/release commit
  // together — a crash between them would leave the new upload unclaimed
  // (sweepable, broken image) or the old one claimed forever.
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(courses)
      .set({
        title: input.title,
        shortDescription: input.shortDescription,
        description: input.description,
        thumbnail: input.thumbnail,
        courseType: input.courseType,
        location: input.location,
        scheduledAt:
          input.scheduledAt !== undefined ? (input.scheduledAt ? new Date(input.scheduledAt) : null) : undefined,
        scheduledEndAt:
          input.scheduledEndAt !== undefined
            ? input.scheduledEndAt
              ? new Date(input.scheduledEndAt)
              : null
            : undefined,
        registrationOpenAt:
          input.registrationOpenAt !== undefined
            ? input.registrationOpenAt
              ? new Date(input.registrationOpenAt)
              : null
            : undefined,
        registrationCloseAt:
          input.registrationCloseAt !== undefined
            ? input.registrationCloseAt
              ? new Date(input.registrationCloseAt)
              : null
            : undefined,
        registrantQuota: input.registrantQuota,
        participantQuota: input.participantQuota,
        level: input.level,
        language: input.language,
        trainingType: input.trainingType,
        customTrainingType: input.customTrainingType,
        isDisabilityFriendly: input.isDisabilityFriendly,
        supportedDisabilityTypes: input.supportedDisabilityTypes,
        minimumEducation: input.minimumEducation,
        minimumAge: input.minimumAge,
        maximumAge: input.maximumAge,
        cityCode: input.cityCode,
        fundingSource: input.fundingSource,
        customFundingSource: input.customFundingSource,
        trainingBudget: input.trainingBudget,
        contactPersonName: input.contactPersonName,
        contactPersonPhone: input.contactPersonPhone,
        price: input.price,
        updatedAt: new Date(),
      })
      .where(eq(courses.id, id))
      .returning()

    if (existing.thumbnail !== row!.thumbnail) {
      const oldUploadId = extractUploadIdFromUrl(existing.thumbnail)
      if (oldUploadId) await releaseUpload(oldUploadId, tx)
      const newUploadId = extractUploadIdFromUrl(row!.thumbnail)
      if (newUploadId) await claimUpload(newUploadId, "course", row!.id, tx)
    }
    return row!
  })
  return toCourse(updated)
}

async function setCourseStatus(
  id: string,
  status: "draft" | "published",
  actingUser: { id: string; role?: string | null }
): Promise<Course> {
  const existing = await getCourse(id)
  await assertCanManageInstitution(actingUser, existing.institutionId)

  const [row] = await db.update(courses).set({ status, updatedAt: new Date() }).where(eq(courses.id, id)).returning()
  return await toCourse(row!)
}

export function publishCourse(id: string, actingUser: { id: string; role?: string | null }): Promise<Course> {
  return setCourseStatus(id, "published", actingUser)
}

export function unpublishCourse(id: string, actingUser: { id: string; role?: string | null }): Promise<Course> {
  return setCourseStatus(id, "draft", actingUser)
}
