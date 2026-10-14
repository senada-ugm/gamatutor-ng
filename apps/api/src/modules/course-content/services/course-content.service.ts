import type {
  Lesson,
  LessonCreate,
  LessonProgress,
  LessonUpdate,
  Module,
  ModuleCreate,
  ModuleUpdate,
} from "@workspace/contracts"
import { and, asc, eq, inArray } from "drizzle-orm"
import { db } from "../../../db/index.js"
import { courseLessons, courseModules, lessonProgress } from "../../../db/app-schema.js"
import { NotFoundError } from "../../../lib/errors.js"
import { generateId } from "../../../lib/response.js"
import { claimUpload, extractUploadIdFromUrl, releaseUpload } from "../../uploads/services/uploads.service.js"

function toLesson(row: typeof courseLessons.$inferSelect): Lesson {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    isPreview: row.isPreview,
    contentType: (row.contentType as Lesson["contentType"]) ?? undefined,
    textContent: row.textContent ?? undefined,
    url: row.url ?? undefined,
    duration: row.duration ?? undefined,
  }
}

function toModule(row: typeof courseModules.$inferSelect, lessons: Lesson[]): Module {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    lessons,
  }
}

/** Composes a course's full module/lesson tree from the normalized
 *  tables — used by courses.service.ts's toCourse() so Course.modules
 *  keeps its existing shape even though it's no longer a JSONB column. */
export async function composeModules(courseId: string): Promise<Module[]> {
  return (await composeModulesBatch([courseId])).get(courseId) ?? []
}

/** Same composition for many courses at once — two queries total instead
 *  of two per course, so list endpoints that embed each course's full
 *  module tree don't turn into an N+1 storm. */
export async function composeModulesBatch(courseIds: string[]): Promise<Map<string, Module[]>> {
  if (courseIds.length === 0) return new Map()
  const moduleRows = await db
    .select()
    .from(courseModules)
    .where(inArray(courseModules.courseId, courseIds))
    .orderBy(asc(courseModules.position))
  const lessonRows = moduleRows.length
    ? await db
        .select()
        .from(courseLessons)
        .where(
          inArray(
            courseLessons.moduleId,
            moduleRows.map((m) => m.id)
          )
        )
        .orderBy(asc(courseLessons.position))
    : []

  const lessonsByModuleId = new Map<string, Lesson[]>()
  for (const lesson of lessonRows) {
    const list = lessonsByModuleId.get(lesson.moduleId) ?? []
    list.push(toLesson(lesson))
    lessonsByModuleId.set(lesson.moduleId, list)
  }

  const byCourse = new Map<string, Module[]>()
  for (const moduleRow of moduleRows) {
    const list = byCourse.get(moduleRow.courseId) ?? []
    list.push(toModule(moduleRow, lessonsByModuleId.get(moduleRow.id) ?? []))
    byCourse.set(moduleRow.courseId, list)
  }
  return byCourse
}

async function getModuleRow(moduleId: string) {
  const [row] = await db.select().from(courseModules).where(eq(courseModules.id, moduleId)).limit(1)
  if (!row) throw new NotFoundError("Module", moduleId)
  return row
}

export async function getModuleCourseId(moduleId: string): Promise<string> {
  return (await getModuleRow(moduleId)).courseId
}

export async function createModule(courseId: string, input: ModuleCreate): Promise<Module> {
  const existing = await db
    .select({ position: courseModules.position })
    .from(courseModules)
    .where(eq(courseModules.courseId, courseId))
  const nextPosition = existing.length ? Math.max(...existing.map((r) => r.position)) + 1 : 0

  const [row] = await db
    .insert(courseModules)
    .values({
      id: generateId("cmd"),
      courseId,
      title: input.title,
      description: input.description,
      position: nextPosition,
    })
    .returning()
  return toModule(row!, [])
}

export async function updateModule(moduleId: string, input: ModuleUpdate): Promise<Module> {
  const [row] = await db
    .update(courseModules)
    .set({ title: input.title, description: input.description, updatedAt: new Date() })
    .where(eq(courseModules.id, moduleId))
    .returning()
  if (!row) throw new NotFoundError("Module", moduleId)
  const lessonRows = await db
    .select()
    .from(courseLessons)
    .where(eq(courseLessons.moduleId, moduleId))
    .orderBy(asc(courseLessons.position))
  return toModule(row, lessonRows.map(toLesson))
}

export async function deleteModule(moduleId: string): Promise<void> {
  await getModuleRow(moduleId)
  await db.delete(courseModules).where(eq(courseModules.id, moduleId))
}

async function getLessonRow(lessonId: string) {
  const [row] = await db.select().from(courseLessons).where(eq(courseLessons.id, lessonId)).limit(1)
  if (!row) throw new NotFoundError("Lesson", lessonId)
  return row
}

export async function getLessonCourseId(lessonId: string): Promise<string> {
  const lesson = await getLessonRow(lessonId)
  return getModuleCourseId(lesson.moduleId)
}

export async function createLesson(moduleId: string, input: LessonCreate): Promise<Lesson> {
  const module = await getModuleRow(moduleId)
  const rows = await db
    .select({ position: courseLessons.position })
    .from(courseLessons)
    .where(eq(courseLessons.moduleId, moduleId))
    .orderBy(asc(courseLessons.position))
  const nextPosition = rows.length ? Math.max(...rows.map((r) => r.position)) + 1 : 0

  const [row] = await db
    .insert(courseLessons)
    .values({
      id: generateId("lsn"),
      moduleId,
      title: input.title,
      description: input.description,
      isPreview: input.isPreview ?? false,
      contentType: input.contentType,
      textContent: input.textContent,
      url: input.url,
      duration: input.duration,
      position: nextPosition,
    })
    .returning()

  // A lesson's media may be an upload URL — claim it under the owning
  // course (same lifecycle as Course.thumbnail) so the orphan sweep
  // can't delete a file a saved lesson references.
  const uploadId = extractUploadIdFromUrl(row!.url)
  if (uploadId) await claimUpload(uploadId, "course", module.courseId)

  return toLesson(row!)
}

export async function updateLesson(lessonId: string, input: LessonUpdate): Promise<Lesson> {
  const existing = await getLessonRow(lessonId)
  const [row] = await db
    .update(courseLessons)
    .set({
      title: input.title,
      description: input.description,
      isPreview: input.isPreview ?? false,
      contentType: input.contentType,
      textContent: input.textContent,
      url: input.url,
      duration: input.duration,
      updatedAt: new Date(),
    })
    .where(eq(courseLessons.id, lessonId))
    .returning()
  if (!row) throw new NotFoundError("Lesson", lessonId)

  // Swapping the media reference releases the old upload back to the
  // orphan pool and claims the new one — mirrors courses.service.ts's
  // thumbnail handling.
  const oldUploadId = extractUploadIdFromUrl(existing.url)
  const newUploadId = extractUploadIdFromUrl(row.url)
  if (oldUploadId && oldUploadId !== newUploadId) await releaseUpload(oldUploadId)
  if (newUploadId && newUploadId !== oldUploadId) {
    await claimUpload(newUploadId, "course", await getModuleCourseId(row.moduleId))
  }

  return toLesson(row)
}

export async function deleteLesson(lessonId: string): Promise<void> {
  const lesson = await getLessonRow(lessonId)
  const uploadId = extractUploadIdFromUrl(lesson.url)
  await db.delete(courseLessons).where(eq(courseLessons.id, lessonId))
  if (uploadId) await releaseUpload(uploadId)
}

function toLessonProgress(row: typeof lessonProgress.$inferSelect): LessonProgress {
  return {
    id: row.id,
    userId: row.userId,
    lessonId: row.lessonId,
    courseId: row.courseId,
    completedAt: row.completedAt.toISOString(),
  }
}

export async function listLessonProgress(courseId: string, userId: string): Promise<LessonProgress[]> {
  const rows = await db
    .select()
    .from(lessonProgress)
    .where(and(eq(lessonProgress.courseId, courseId), eq(lessonProgress.userId, userId)))
  return rows.map(toLessonProgress)
}

export async function completeLesson(userId: string, lessonId: string, courseId: string): Promise<LessonProgress> {
  // onConflictDoNothing + re-read instead of select-then-insert: two
  // concurrent completions previously raced past the existence check and
  // one died on the (userId, lessonId) unique index with a raw pg error.
  const [inserted] = await db
    .insert(lessonProgress)
    .values({ id: generateId("lpg"), userId, lessonId, courseId })
    .onConflictDoNothing()
    .returning()
  if (inserted) return toLessonProgress(inserted)

  const [existing] = await db
    .select()
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)))
    .limit(1)
  return toLessonProgress(existing!)
}

export async function uncompleteLesson(userId: string, lessonId: string): Promise<void> {
  await db.delete(lessonProgress).where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)))
}
