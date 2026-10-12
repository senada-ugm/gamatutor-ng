import type { Announcement } from "@workspace/contracts"
import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { db } from "../../../db/index.js"
import { announcements, enrollments } from "../../../db/app-schema.js"
import { users as userTable } from "../../../db/auth-schema.js"
import { NotFoundError } from "../../../lib/errors.js"
import { notifyUserById } from "../../../lib/notify.js"
import { generateId } from "../../../lib/response.js"

type Row = typeof announcements.$inferSelect

function toAnnouncement(row: Row, authorName: string): Announcement {
  return {
    id: row.id,
    courseId: row.courseId,
    title: row.title,
    content: row.content,
    user: { id: row.createdById, name: authorName },
    isPublished: row.isPublished,
    publishedAt: row.publishedAt?.toISOString(),
    isPinned: row.isPinned,
    priority: row.priority as Announcement["priority"],
    createdAt: row.createdAt.toISOString(),
  }
}

async function authorNamesBatch(rows: Row[]): Promise<Map<string, string>> {
  if (rows.length === 0) return new Map()
  const accounts = await db
    .select({ id: userTable.id, name: userTable.name })
    .from(userTable)
    .where(inArray(userTable.id, [...new Set(rows.map((r) => r.createdById))]))
  return new Map(accounts.map((a) => [a.id, a.name]))
}

/** Published-only for participants, everything for managers (route
 *  decides via the includeDrafts flag). Pinned first, then newest. */
export async function listAnnouncements(
  courseId: string,
  includeDrafts: boolean,
  page: number,
  pageSize: number
): Promise<{ rows: Announcement[]; totalCount: number }> {
  const where = includeDrafts
    ? eq(announcements.courseId, courseId)
    : and(eq(announcements.courseId, courseId), eq(announcements.isPublished, true))
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(announcements)
    .where(where)
  const rows = await db
    .select()
    .from(announcements)
    .where(where)
    .orderBy(desc(announcements.isPinned), desc(announcements.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
  const names = await authorNamesBatch(rows)
  return {
    rows: rows.map((r) => toAnnouncement(r, names.get(r.createdById) ?? r.createdById)),
    totalCount: countRow?.count ?? 0,
  }
}

export async function getAnnouncementRow(id: string): Promise<Row> {
  const [row] = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1)
  if (!row) throw new NotFoundError("Announcement", id)
  return row
}

export async function createAnnouncement(
  input: {
    courseId: string
    title: string
    content: string
    isPublished?: boolean
    isPinned?: boolean
    priority?: string
  },
  author: { id: string; name: string }
): Promise<Announcement> {
  const publish = input.isPublished ?? false
  const [row] = await db
    .insert(announcements)
    .values({
      id: generateId("anc"),
      courseId: input.courseId,
      title: input.title,
      content: input.content,
      createdById: author.id,
      isPublished: publish,
      publishedAt: publish ? new Date() : null,
      isPinned: input.isPinned ?? false,
      priority: input.priority ?? "normal",
    })
    .returning()
  const created = toAnnouncement(row!, author.name)
  if (publish) await fanOutNotifications(created)
  return created
}

/** One notification per ACTIVE participant of the course (selected or
 *  graduated) — a manager broadcasting to their own roster. */
async function fanOutNotifications(announcement: Announcement): Promise<void> {
  const participants = await db
    .select({ userId: enrollments.userId })
    .from(enrollments)
    .where(and(eq(enrollments.courseId, announcement.courseId), inArray(enrollments.status, ["selected", "graduated"])))
  await Promise.all(
    participants.map((p) =>
      notifyUserById(p.userId, {
        type: "announcement",
        title: `Pengumuman: ${announcement.title}`,
        body: announcement.content.slice(0, 200),
        link: `/learn/${announcement.courseId}`,
      })
    )
  )
}

async function patchAnnouncement(id: string, patch: Partial<Row>): Promise<Announcement> {
  const row = await getAnnouncementRow(id)
  const [updated] = await db.update(announcements).set(patch).where(eq(announcements.id, id)).returning()
  const finalRow = updated ?? row
  const names = await authorNamesBatch([finalRow])
  const result = toAnnouncement(finalRow, names.get(finalRow.createdById) ?? finalRow.createdById)
  if (patch.isPublished === true) await fanOutNotifications(result)
  return result
}

export function pinAnnouncement(id: string) {
  return patchAnnouncement(id, { isPinned: true })
}

export function unpinAnnouncement(id: string) {
  return patchAnnouncement(id, { isPinned: false })
}

export function publishAnnouncement(id: string) {
  return patchAnnouncement(id, { isPublished: true, publishedAt: new Date() })
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await getAnnouncementRow(id)
  await db.delete(announcements).where(eq(announcements.id, id))
}
