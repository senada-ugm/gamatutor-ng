import type { User, UserRole, AccountStatus } from "@workspace/contracts"
import { and, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm"
import { orderByClause } from "../../../lib/order.js"
import { db } from "../../../db/index.js"
import { sessions as sessionTable, users as usersTable } from "../../../db/auth-schema.js"
import { courseInstructors, institutionOwnerships } from "../../../db/app-schema.js"
import { ConflictError, NotFoundError } from "../../../lib/errors.js"
import { ilikeContains } from "../../../lib/search.js"

export interface ListUsersFilters {
  role?: UserRole
  status?: AccountStatus
  search?: string
}

function toUser(row: typeof usersTable.$inferSelect): User {
  const isSuspended = row.banned === true
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: (row.role as UserRole) ?? "user",
    status: isSuspended ? "suspended" : "active",
    joinedAt: row.createdAt.toISOString(),
    suspendedAt: isSuspended ? row.updatedAt.toISOString() : undefined,
    suspendedReason: isSuspended ? (row.banReason ?? undefined) : undefined,
  }
}

function buildUserConditions(filters: ListUsersFilters) {
  return [
    filters.role ? eq(usersTable.role, filters.role) : undefined,
    filters.status === "suspended"
      ? eq(usersTable.banned, true)
      : filters.status === "active"
        ? or(eq(usersTable.banned, false), isNull(usersTable.banned))
        : undefined,
    filters.search
      ? or(
          ilike(usersTable.name, ilikeContains(filters.search)),
          ilike(usersTable.email, ilikeContains(filters.search))
        )
      : undefined,
  ].filter((c) => c !== undefined)
}

export async function listUsersPaged(
  filters: ListUsersFilters & { page: number; pageSize: number; orderBy?: string }
): Promise<{ rows: User[]; totalCount: number }> {
  const conditions = buildUserConditions(filters)
  const where = conditions.length ? and(...conditions) : undefined
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(where)
  const rows = await db
    .select()
    .from(usersTable)
    .where(where)
    .orderBy(
      orderByClause(
        filters.orderBy,
        { createdAt: usersTable.createdAt, name: usersTable.name, email: usersTable.email },
        desc(usersTable.createdAt)
      )
    )
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize)

  return { rows: rows.map(toUser), totalCount: countRow?.count ?? 0 }
}

export async function getUser(id: string): Promise<User> {
  const [row] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1)
  if (!row) throw new NotFoundError("User", id)
  return toUser(row)
}

/** Suspend an active account in Postgres — refuses to double-suspend.
 *  Also deletes every session row for the account: Better Auth only
 *  enforces `banned` when *creating* a session (its admin banUser route
 *  does the revocation itself), so a bare column write would leave the
 *  suspended user's existing cookie working until natural expiry.
 *  Belt-and-braces: the session helpers also refuse `banned` users, in
 *  case a session slips through (e.g. signed in during the suspend call). */
export async function suspendUser(id: string, reason: string): Promise<User> {
  const user = await getUser(id)
  if (user.status === "suspended") {
    throw new ConflictError(`User ${id} is already suspended`)
  }

  const [row] = await db
    .update(usersTable)
    .set({
      banned: true,
      banReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, id))
    .returning()
  if (!row) throw new NotFoundError("User", id)

  await db.delete(sessionTable).where(eq(sessionTable.userId, id))
  return toUser(row)
}

/** Batch capability lookup for the admin user-management badges: one
 *  ownership query + one instructor query for the whole page of users. */
export async function getUserCapabilities(
  userIds: string[]
): Promise<Array<{ userId: string; ownedInstitutionIds: string[]; isInstructor: boolean }>> {
  if (userIds.length === 0) return []
  const uniqueIds = [...new Set(userIds)]
  const [ownershipRows, instructorRows] = await Promise.all([
    db
      .select({ userId: institutionOwnerships.userId, institutionId: institutionOwnerships.institutionId })
      .from(institutionOwnerships)
      .where(inArray(institutionOwnerships.userId, uniqueIds)),
    db
      .selectDistinct({ userId: courseInstructors.userId })
      .from(courseInstructors)
      .where(
        and(
          inArray(courseInstructors.userId, uniqueIds),
          eq(courseInstructors.status, "active"),
          isNotNull(courseInstructors.userId)
        )
      ),
  ])
  const ownedByUser = new Map<string, string[]>(uniqueIds.map((id) => [id, []]))
  for (const row of ownershipRows) {
    ownedByUser.get(row.userId)?.push(row.institutionId)
  }
  const instructorIds = new Set(instructorRows.map((r) => r.userId))
  return uniqueIds.map((userId) => ({
    userId,
    ownedInstitutionIds: ownedByUser.get(userId) ?? [],
    isInstructor: instructorIds.has(userId),
  }))
}

/** Re-activate a suspended account; clears suspension bookkeeping. */
export async function reactivateUser(id: string): Promise<User> {
  const user = await getUser(id)
  if (user.status === "active") {
    throw new ConflictError(`User ${id} is not suspended`)
  }

  const [row] = await db
    .update(usersTable)
    .set({
      banned: false,
      banReason: null,
      banExpires: null,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, id))
    .returning()

  if (!row) throw new NotFoundError("User", id)
  return toUser(row)
}
