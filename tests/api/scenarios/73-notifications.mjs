import { check, eq, status } from "../lib/assert.mjs"

/**
 * Notifications surface (rows are fed by earlier business events).
 */
export async function run(ctx) {
  console.log("\n== Notifications ==")
  const { user, anon } = ctx

  const list = status("user lists their notifications", await user.get("/v1/notifications?pageSize=50"), 200)
  const unread = (list?.data ?? []).filter((n) => !n.readAt)
  check("has unread entries to mark", unread.length > 0)
  if (unread[0]) {
    status("user marks one notification read", await user.post(`/v1/notifications/${unread[0].id}/read`), 200)
  }
  status("user marks everything read", await user.post("/v1/notifications/read-all"), 204)
  const after = status("user re-lists notifications", await user.get("/v1/notifications?pageSize=50"), 200)
  check(
    "nothing left unread",
    (after?.data ?? []).every((n) => n.readAt)
  )
  status("anon cannot list notifications", await anon.get("/v1/notifications"), 401)
}
