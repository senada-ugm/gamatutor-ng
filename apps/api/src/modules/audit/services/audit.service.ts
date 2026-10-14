import { and, desc, ilike, or, sql } from "drizzle-orm"
import { db } from "../../../db/index.js"
import { auditLog } from "../../../db/app-schema.js"

function toAuditLogEntry(row: typeof auditLog.$inferSelect) {
  return {
    id: row.id,
    actorUserId: row.actorUserId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata: row.metadata ?? undefined,
    createdAt: row.createdAt.toISOString(),
  }
}

/** Newest-first page of the audit trail, optionally filtered by a
 *  wildcard search over action / entity / actor. Admin-only (route-level). */
export async function listAuditLogPaged(params: {
  page: number
  pageSize: number
  search?: string
}): Promise<{ rows: ReturnType<typeof toAuditLogEntry>[]; totalCount: number }> {
  const term = params.search?.trim()
  const filter = term
    ? or(
        ilike(auditLog.action, `%${term}%`),
        ilike(auditLog.entityType, `%${term}%`),
        ilike(auditLog.entityId, `%${term}%`),
        ilike(auditLog.actorUserId, `%${term}%`)
      )
    : undefined

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(filter ? and(filter) : undefined)
  const rows = await db
    .select()
    .from(auditLog)
    .where(filter ? and(filter) : undefined)
    .orderBy(desc(auditLog.createdAt))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize)
  return { rows: rows.map(toAuditLogEntry), totalCount: countRow?.count ?? 0 }
}
