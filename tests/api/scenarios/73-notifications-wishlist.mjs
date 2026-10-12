import { check, eq, status } from "../lib/assert.mjs"

/**
 * Notifications (fed by earlier business events: the confirmed payment,
 * graded work) and the wishlist surface.
 */
export async function run(ctx) {
  console.log("\n== Notifications & Wishlist ==")
  const { user, anon } = ctx

  const list = status("user lists their notifications", await user.get("/v1/notifications?pageSize=50"), 200)
  check(
    "payment confirmation produced a notification",
    (list?.data ?? []).some((n) => n.type === "order_paid")
  )
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

  // wishlist round-trip against the paid course
  const courseId = ctx.ids.paidCourse
  status("user wishlists the paid course", await user.post("/v1/wishlist", { json: { courseId } }), 201)
  const wl = status("user lists their wishlist", await user.get("/v1/wishlist"), 200)
  check(
    "wishlisted course present",
    (wl?.data ?? []).some((w) => w.courseId === courseId)
  )
  status("user removes it from the wishlist", await user.delete(`/v1/wishlist/${courseId}`), 204)
  const wl2 = status("user re-lists their wishlist", await user.get("/v1/wishlist"), 200)
  check("removed from the wishlist", !(wl2?.data ?? []).some((w) => w.courseId === courseId))
  status("anon cannot wishlist", await anon.post("/v1/wishlist", { json: { courseId } }), 401)
}
