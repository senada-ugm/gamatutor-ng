import { auditLog } from "../db/app-schema.js"
import { db } from "../db/index.js"
import { generateId } from "./response.js"

/**
 * Append-only audit trail for privileged actions. Called by the routes
 * that perform the action, after the action succeeded. A failed audit
 * write must never break the business action — it's logged loudly
 * instead, and the gap is visible as a missing entry.
 */
export async function recordAudit(entry: {
  actorUserId: string
  action: string
  entityType: string
  entityId: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    await db.insert(auditLog).values({
      id: generateId("aud"),
      actorUserId: entry.actorUserId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata,
    })
  } catch (error) {
    console.error("[audit] failed to record", entry, error)
  }
}
