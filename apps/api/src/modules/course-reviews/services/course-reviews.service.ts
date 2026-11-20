import { and, desc, eq, sql } from "drizzle-orm"
import type { CourseReview, CourseReviewSummary, CourseReviewUpsert } from "@workspace/contracts"
import { db } from "../../../db/index.js"
import { courseReviews, courses } from "../../../db/app-schema.js"
import { users } from "../../../db/auth-schema.js"
import { NotFoundError } from "../../../lib/errors.js"
import { generateId } from "../../../lib/response.js"

function toCourseReviewDto(row: {
  id: string
  courseId: string
  userId: string
  userName: string | null
  rating: number
  review: string | null
  suggestion: string | null
  createdAt: Date
  updatedAt: Date
}): CourseReview {
  return {
    id: row.id,
    courseId: row.courseId,
    userId: row.userId,
    userName: row.userName ?? "Peserta",
    rating: row.rating,
    review: row.review ?? undefined,
    suggestion: row.suggestion ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function assertCourseExists(courseId: string) {
  const [course] = await db.select({ id: courses.id }).from(courses).where(eq(courses.id, courseId)).limit(1)
  if (!course) throw new NotFoundError(`Course ${courseId} not found`)
}

export async function listCourseReviews(courseId: string, page = 1, pageSize = 20) {
  await assertCourseExists(courseId)
  const offset = (page - 1) * pageSize

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(courseReviews)
    .where(eq(courseReviews.courseId, courseId))

  const rows = await db
    .select({
      id: courseReviews.id,
      courseId: courseReviews.courseId,
      userId: courseReviews.userId,
      userName: users.name,
      rating: courseReviews.rating,
      review: courseReviews.review,
      suggestion: courseReviews.suggestion,
      createdAt: courseReviews.createdAt,
      updatedAt: courseReviews.updatedAt,
    })
    .from(courseReviews)
    .leftJoin(users, eq(courseReviews.userId, users.id))
    .where(eq(courseReviews.courseId, courseId))
    .orderBy(desc(courseReviews.updatedAt))
    .limit(pageSize)
    .offset(offset)

  return {
    items: rows.map(toCourseReviewDto),
    total: countRow?.count ?? 0,
  }
}

export async function getCourseReviewSummary(courseId: string, userId?: string): Promise<CourseReviewSummary> {
  await assertCourseExists(courseId)

  const [agg] = await db
    .select({
      totalReviews: sql<number>`count(*)::int`,
      averageRating: sql<number>`coalesce(round(avg(${courseReviews.rating})::numeric, 2)::float8, 0)`,
    })
    .from(courseReviews)
    .where(eq(courseReviews.courseId, courseId))

  let myReview: CourseReview | undefined
  if (userId) {
    const [mine] = await db
      .select({
        id: courseReviews.id,
        courseId: courseReviews.courseId,
        userId: courseReviews.userId,
        userName: users.name,
        rating: courseReviews.rating,
        review: courseReviews.review,
        suggestion: courseReviews.suggestion,
        createdAt: courseReviews.createdAt,
        updatedAt: courseReviews.updatedAt,
      })
      .from(courseReviews)
      .leftJoin(users, eq(courseReviews.userId, users.id))
      .where(and(eq(courseReviews.courseId, courseId), eq(courseReviews.userId, userId)))
      .limit(1)
    if (mine) myReview = toCourseReviewDto(mine)
  }

  return {
    averageRating: agg?.averageRating ?? 0,
    totalReviews: agg?.totalReviews ?? 0,
    myReview,
  }
}

export async function upsertMyCourseReview(
  courseId: string,
  userId: string,
  body: CourseReviewUpsert
): Promise<CourseReview> {
  await assertCourseExists(courseId)

  const reviewText = body.review?.trim() || null
  const suggestionText = body.suggestion?.trim() || null
  const now = new Date()

  const [existing] = await db
    .select({ id: courseReviews.id })
    .from(courseReviews)
    .where(and(eq(courseReviews.courseId, courseId), eq(courseReviews.userId, userId)))
    .limit(1)

  if (existing) {
    await db
      .update(courseReviews)
      .set({
        rating: body.rating,
        review: reviewText,
        suggestion: suggestionText,
        updatedAt: now,
      })
      .where(eq(courseReviews.id, existing.id))
  } else {
    await db.insert(courseReviews).values({
      id: generateId("rev"),
      courseId,
      userId,
      rating: body.rating,
      review: reviewText,
      suggestion: suggestionText,
      createdAt: now,
      updatedAt: now,
    })
  }

  const [saved] = await db
    .select({
      id: courseReviews.id,
      courseId: courseReviews.courseId,
      userId: courseReviews.userId,
      userName: users.name,
      rating: courseReviews.rating,
      review: courseReviews.review,
      suggestion: courseReviews.suggestion,
      createdAt: courseReviews.createdAt,
      updatedAt: courseReviews.updatedAt,
    })
    .from(courseReviews)
    .leftJoin(users, eq(courseReviews.userId, users.id))
    .where(and(eq(courseReviews.courseId, courseId), eq(courseReviews.userId, userId)))
    .limit(1)

  return toCourseReviewDto(saved!)
}
