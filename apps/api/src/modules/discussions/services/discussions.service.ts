import type {
  Discussion,
  DiscussionCreate,
  DiscussionDetail,
  DiscussionReply,
  DiscussionReplyCreate,
} from "@workspace/contracts"
import { and, eq, inArray, sql } from "drizzle-orm"
import { db } from "../../../db/index.js"
import { discussionReplies, discussions } from "../../../db/app-schema.js"
import { users as userTable } from "../../../db/auth-schema.js"
import { NotFoundError } from "../../../lib/errors.js"
import { generateId } from "../../../lib/response.js"

type DiscussionRow = typeof discussions.$inferSelect
type ReplyRow = typeof discussionReplies.$inferSelect

/** Composes many discussions with three queries total (accounts, replies,
 *  nothing else) instead of 3-4 per row — list endpoints call this with
 *  every row they loaded. */
async function toDiscussions(rows: DiscussionRow[]): Promise<Discussion[]> {
  if (rows.length === 0) return []
  const replyRows = await db
    .select()
    .from(discussionReplies)
    .where(
      inArray(
        discussionReplies.discussionId,
        rows.map((r) => r.id)
      )
    )

  const authorIds = rows.map((r) => r.userId)
  const lastReplyByUserId = new Map<string, string>()
  const repliesByDiscussionId = new Map<string, ReplyRow[]>()
  for (const reply of replyRows) {
    const list = repliesByDiscussionId.get(reply.discussionId) ?? []
    list.push(reply)
    repliesByDiscussionId.set(reply.discussionId, list)
  }
  for (const [discussionId, list] of repliesByDiscussionId) {
    const last = [...list].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
    if (last) lastReplyByUserId.set(discussionId, last.userId)
  }
  const accountIds = [...new Set([...authorIds, ...lastReplyByUserId.values()])]
  const accounts = await db.select().from(userTable).where(inArray(userTable.id, accountIds))
  const accountById = new Map(accounts.map((a) => [a.id, a]))

  return rows.map((row) => {
    const replies = repliesByDiscussionId.get(row.id) ?? []
    const lastReply = [...replies].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
    const account = accountById.get(row.userId)
    const lastReplyByAccount = lastReply ? accountById.get(lastReply.userId) : undefined
    return {
      id: row.id,
      courseId: row.courseId,
      lessonId: row.lessonId ?? undefined,
      title: row.title,
      content: row.content,
      isPinned: row.isPinned,
      isClosed: row.isClosed,
      isResolved: row.isResolved,
      viewCount: row.viewCount,
      replyCount: replies.length,
      lastReplyAt: lastReply?.createdAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      user: { id: row.userId, name: account?.name ?? row.userId, email: account?.email ?? "" },
      lastReplyByUser: lastReplyByAccount
        ? { id: lastReplyByAccount.id, name: lastReplyByAccount.name, email: lastReplyByAccount.email }
        : undefined,
    }
  })
}

async function toDiscussion(row: DiscussionRow): Promise<Discussion> {
  return (await toDiscussions([row]))[0]!
}

async function toReply(row: ReplyRow): Promise<DiscussionReply> {
  const [account] = await db.select().from(userTable).where(eq(userTable.id, row.userId)).limit(1)
  return {
    id: row.id,
    discussionId: row.discussionId,
    parentReplyId: row.parentReplyId ?? undefined,
    content: row.isDeleted ? "[Balasan ini telah dihapus]" : row.content,
    isDeleted: row.isDeleted,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    user: { id: row.userId, name: account?.name ?? row.userId, email: account?.email ?? "" },
  }
}

export async function getDiscussionRow(id: string): Promise<DiscussionRow> {
  const [row] = await db.select().from(discussions).where(eq(discussions.id, id)).limit(1)
  if (!row) throw new NotFoundError("Discussion", id)
  return row
}

export async function listDiscussions(courseId: string, lessonId?: string): Promise<Discussion[]> {
  const rows = await db
    .select()
    .from(discussions)
    .where(
      lessonId
        ? and(eq(discussions.courseId, courseId), eq(discussions.lessonId, lessonId))
        : eq(discussions.courseId, courseId)
    )
  const items = await toDiscussions(rows)
  return items.sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    return new Date(b.lastReplyAt ?? b.createdAt).getTime() - new Date(a.lastReplyAt ?? a.createdAt).getTime()
  })
}

async function toDiscussionDetail(row: DiscussionRow): Promise<DiscussionDetail> {
  const discussion = await toDiscussion(row)
  const replyRows = await db
    .select()
    .from(discussionReplies)
    .where(eq(discussionReplies.discussionId, row.id))
    .orderBy(discussionReplies.createdAt)
  const accounts = replyRows.length
    ? await db
        .select()
        .from(userTable)
        .where(inArray(userTable.id, [...new Set(replyRows.map((r) => r.userId))]))
    : []
  const accountById = new Map(accounts.map((a) => [a.id, a]))
  const replies: DiscussionReply[] = replyRows.map((replyRow) => {
    const account = accountById.get(replyRow.userId)
    return {
      id: replyRow.id,
      discussionId: replyRow.discussionId,
      parentReplyId: replyRow.parentReplyId ?? undefined,
      content: replyRow.isDeleted ? "[Balasan ini telah dihapus]" : replyRow.content,
      isDeleted: replyRow.isDeleted,
      createdAt: replyRow.createdAt.toISOString(),
      updatedAt: replyRow.updatedAt.toISOString(),
      user: { id: replyRow.userId, name: account?.name ?? replyRow.userId, email: account?.email ?? "" },
    }
  })
  return { ...discussion, replies }
}

export async function createDiscussion(
  courseId: string,
  userId: string,
  input: DiscussionCreate
): Promise<DiscussionDetail> {
  const [row] = await db
    .insert(discussions)
    .values({
      id: generateId("dsc"),
      courseId,
      lessonId: input.lessonId,
      title: input.title,
      content: input.content,
      userId,
    })
    .returning()
  return toDiscussionDetail(row!)
}

/** Increments viewCount as an atomic side effect, matching the UI's
 *  "opening a thread always counts as a view" behavior. */
export async function getDiscussionDetail(id: string): Promise<DiscussionDetail> {
  await getDiscussionRow(id)
  const [updated] = await db
    .update(discussions)
    .set({ viewCount: sql`${discussions.viewCount} + 1` })
    .where(eq(discussions.id, id))
    .returning()
  return toDiscussionDetail(updated!)
}

export async function deleteDiscussion(id: string): Promise<void> {
  await getDiscussionRow(id)
  await db.delete(discussions).where(eq(discussions.id, id))
}

async function setDiscussionFlags(
  id: string,
  patch: Partial<Pick<DiscussionRow, "isPinned" | "isClosed" | "isResolved">>
): Promise<Discussion> {
  await getDiscussionRow(id)
  const [row] = await db
    .update(discussions)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(discussions.id, id))
    .returning()
  return toDiscussion(row!)
}

export const pinDiscussion = (id: string) => setDiscussionFlags(id, { isPinned: true })
export const unpinDiscussion = (id: string) => setDiscussionFlags(id, { isPinned: false })
export const closeDiscussion = (id: string) => setDiscussionFlags(id, { isClosed: true })
export const reopenDiscussion = (id: string) => setDiscussionFlags(id, { isClosed: false })
export const resolveDiscussion = (id: string) => setDiscussionFlags(id, { isResolved: true })
export const unresolveDiscussion = (id: string) => setDiscussionFlags(id, { isResolved: false })

export async function addReply(
  discussionId: string,
  userId: string,
  input: DiscussionReplyCreate
): Promise<DiscussionReply> {
  await getDiscussionRow(discussionId)
  const [row] = await db
    .insert(discussionReplies)
    .values({
      id: generateId("dsr"),
      discussionId,
      parentReplyId: input.parentReplyId,
      content: input.content,
      userId,
    })
    .returning()
  await db.update(discussions).set({ updatedAt: new Date() }).where(eq(discussions.id, discussionId))
  return toReply(row!)
}

export async function getReplyRow(discussionId: string, id: string): Promise<ReplyRow> {
  const [row] = await db
    .select()
    .from(discussionReplies)
    .where(and(eq(discussionReplies.id, id), eq(discussionReplies.discussionId, discussionId)))
    .limit(1)
  if (!row) throw new NotFoundError("DiscussionReply", id)
  return row
}

export async function deleteReply(discussionId: string, id: string): Promise<void> {
  await getReplyRow(discussionId, id)
  await db
    .update(discussionReplies)
    .set({ isDeleted: true, deletedAt: new Date(), content: "" })
    .where(eq(discussionReplies.id, id))
}
