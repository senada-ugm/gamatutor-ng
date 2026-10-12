import { check, eq, status } from "../lib/assert.mjs"

/**
 * Discussion thread reading + full moderation: replies (incl. nested),
 * soft delete, pin/close/resolve toggles by managers and the author.
 */
export async function run(ctx) {
  console.log("\n== Discussions (moderation) ==")
  const { admin, user, anon, ids } = ctx

  const first = status("user opens a discussion thread", await user.get(`/v1/discussions/${ids.thread}`), 200)
  const baseline = first?.data?.viewCount
  const thread = status("user re-opens the thread", await user.get(`/v1/discussions/${ids.thread}`), 200)
  eq("view count increments on open", thread?.data?.viewCount, baseline + 1)

  const reply = status(
    "user replies to the thread",
    await user.post(`/v1/discussions/${ids.thread}/replies`, { json: { content: "Journey moderation reply" } }),
    201
  )
  const replyId = reply?.data?.id
  const nested = status(
    "user nests a reply under it",
    await user.post(`/v1/discussions/${ids.thread}/replies`, { json: { content: "Nested", parentReplyId: replyId } }),
    201
  )
  check("nested reply carries the parent", nested?.data?.parentReplyId === replyId)
  status(
    "anon cannot reply",
    await anon.post(`/v1/discussions/${ids.thread}/replies`, { json: { content: "no" } }),
    401
  )

  // Pin/close are manager-only (the author can delete/resolve, not pin)
  status("thread author cannot pin their own thread", await user.post(`/v1/discussions/${ids.thread}/pin`), 403)
  status("admin pins the thread", await admin.post(`/v1/discussions/${ids.thread}/pin`), 200)
  status("admin unpins it", await admin.post(`/v1/discussions/${ids.thread}/unpin`), 200)
  status("admin closes the thread", await admin.post(`/v1/discussions/${ids.thread}/close`), 200)
  status(
    "replying to a closed thread is rejected",
    await user.post(`/v1/discussions/${ids.thread}/replies`, { json: { content: "late" } }),
    403
  )
  status("admin reopens it", await admin.post(`/v1/discussions/${ids.thread}/reopen`), 200)
  status("user resolves the thread", await user.post(`/v1/discussions/${ids.thread}/resolve`), 200)
  status("admin unresolves it", await admin.post(`/v1/discussions/${ids.thread}/unresolve`), 200)

  status(
    "user soft-deletes their own reply",
    await user.delete(`/v1/discussions/${ids.thread}/replies/${replyId}`),
    204
  )
  const afterDelete = status(
    "thread re-read after reply deletion",
    await user.get(`/v1/discussions/${ids.thread}`),
    200
  )
  const deleted = (afterDelete?.data?.replies ?? []).find((r) => r.id === replyId)
  check("soft-deleted reply keeps its place but flags deleted", deleted?.isDeleted === true)
}
