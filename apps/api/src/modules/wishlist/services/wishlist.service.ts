import type { WishlistItem } from "@workspace/contracts"
import { and, desc, eq, inArray } from "drizzle-orm"
import { db } from "../../../db/index.js"
import { courses, wishlistItems } from "../../../db/app-schema.js"
import { ConflictError, NotFoundError } from "../../../lib/errors.js"
import { generateId } from "../../../lib/response.js"

type Row = typeof wishlistItems.$inferSelect

/** Embeds the course (title/thumbnail/status) for the wishlist page's
 *  cards — one batched lookup per page. */
async function embedCourses(rows: Row[]): Promise<WishlistItem[]> {
  if (rows.length === 0) return []
  const courseRows = await db
    .select()
    .from(courses)
    .where(
      inArray(
        courses.id,
        rows.map((r) => r.courseId)
      )
    )
  const byId = new Map(courseRows.map((c) => [c.id, c]))
  return rows.map((row) => {
    const course = byId.get(row.courseId)
    return {
      id: row.id,
      userId: row.userId,
      courseId: row.courseId,
      course: course
        ? {
            id: course.id,
            title: course.title,
            shortDescription: course.shortDescription ?? undefined,
            thumbnail: course.thumbnail ?? undefined,
            courseType: course.courseType,
            level: course.level,
            status: course.status,
            institutionId: course.institutionId,
            price: course.price ?? undefined,
          }
        : undefined,
      createdAt: row.createdAt.toISOString(),
    }
  })
}

export async function listWishlist(userId: string, page: number, pageSize: number) {
  const rows = await db
    .select()
    .from(wishlistItems)
    .where(eq(wishlistItems.userId, userId))
    .orderBy(desc(wishlistItems.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
  return embedCourses(rows)
}

/** Idempotent add — a duplicate save returns the existing row. */
export async function addToWishlist(userId: string, courseId: string): Promise<WishlistItem> {
  const [course] = await db.select({ status: courses.status }).from(courses).where(eq(courses.id, courseId)).limit(1)
  if (!course) throw new NotFoundError("Course", courseId)
  if (course.status !== "published") throw new ConflictError("Only published courses can be saved")

  const [inserted] = await db
    .insert(wishlistItems)
    .values({ id: generateId("wsh"), userId, courseId })
    .onConflictDoNothing()
    .returning()
  if (inserted) return (await embedCourses([inserted]))[0]!
  const [existing] = await db
    .select()
    .from(wishlistItems)
    .where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.courseId, courseId)))
    .limit(1)
  return (await embedCourses([existing!]))[0]!
}

export async function removeFromWishlist(userId: string, courseId: string): Promise<void> {
  await db.delete(wishlistItems).where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.courseId, courseId)))
}

export async function listWishlistCourseIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ courseId: wishlistItems.courseId })
    .from(wishlistItems)
    .where(eq(wishlistItems.userId, userId))
  return rows.map((r) => r.courseId)
}
