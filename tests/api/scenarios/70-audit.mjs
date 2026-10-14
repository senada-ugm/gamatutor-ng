import { check, status } from "../lib/assert.mjs"

/**
 * Audit log: the privileged actions performed by earlier scenarios
 * (user suspension/reactivation, request approval/rejection, ownership
 * grants) were recorded and are admin-only readable.
 * Runs last — it asserts on actions taken by earlier scenarios.
 */
export async function run(ctx) {
  console.log("\n== Audit Log ==")
  const { admin, user, anon, ids } = ctx

  const log = status("admin reads the audit log", await admin.get("/v1/audit-log?pageSize=100"), 200)
  const entries = log?.data ?? []

  const has = (action, entityId) =>
    entries.some((e) => e.action === action && (entityId === undefined || e.entityId === entityId))

  check("user.suspend recorded with the account id", has("user.suspend", ids.userId))
  check("user.reactivate recorded", has("user.reactivate", ids.userId))
  check("institution_request.approve recorded", has("institution_request.approve", ids.requestApprove))
  check("institution_request.reject recorded", has("institution_request.reject", ids.requestReject))
  check(
    "ownership grant recorded",
    entries.some((e) => e.action === "institution_ownership.grant")
  )
  check(
    "entries carry the admin actor",
    entries.every((e) => e.actorUserId === ids.adminId)
  )

  status("plain user cannot read the audit log", await user.get("/v1/audit-log"), 403)
  status("anon cannot read the audit log", await anon.get("/v1/audit-log"), 401)
}
