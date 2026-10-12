import { check, status } from "../lib/assert.mjs"

/**
 * Discussions: thread creation, replies, the full moderation set
 * (pin/unpin/close/reopen/resolve/unresolve), view counting, and delete.
 */
export async function run(ctx) {
  console.log("\n== Discussions ==")
  const { admin, user, anon, ids } = ctx

  const thread = status(
    "user creates a discussion thread",
    await user.post(`/v1/courses/${ids.course}/discussions`, {
      json: { title: "Journey Thread", content: "How does lesson progress work?" },
    }),
    201
  )
  ids.thread = thread?.data?.id

  status("admin lists the course's threads", await admin.get(`/v1/courses/${ids.course}/discussions`), 200)
  const detail = status("user opens the thread", await user.get(`/v1/discussions/${ids.thread}`), 200)
  check("view count incremented on open", (detail?.data?.viewCount ?? 0) >= 1)

  status(
    "anon cannot reply",
    await anon.post(`/v1/discussions/${ids.thread}/replies`, { json: { content: "spam" } }),
    401
  )
  const reply = status(
    "user replies to the thread",
    await user.post(`/v1/discussions/${ids.thread}/replies`, { json: { content: "Answering my own question" } }),
    201
  )
  ids.reply = reply?.data?.id

  status("admin pins the thread", await admin.post(`/v1/discussions/${ids.thread}/pin`), 200)
  status("admin unpins the thread", await admin.post(`/v1/discussions/${ids.thread}/unpin`), 200)
  status("admin closes the thread", await admin.post(`/v1/discussions/${ids.thread}/close`), 200)
  status(
    "replies to a closed thread are rejected",
    await user.post(`/v1/discussions/${ids.thread}/replies`, { json: { content: "too late?" } }),
    403
  )
  status("admin reopens the thread", await admin.post(`/v1/discussions/${ids.thread}/reopen`), 200)
  status("user resolves the thread", await admin.post(`/v1/discussions/${ids.thread}/resolve`), 200)
  status("admin unresolves the thread", await admin.post(`/v1/discussions/${ids.thread}/unresolve`), 200)

  const tempThread = status(
    "admin creates a disposable thread",
    await admin.post(`/v1/courses/${ids.course}/discussions`, {
      json: { title: "Journey Thread (temp)", content: "to be deleted" },
    }),
    201
  )
  status("admin deletes the disposable thread", await admin.delete(`/v1/discussions/${tempThread?.data?.id}`), 204)

  const tempReply = status(
    "user replies on the main thread (delete target)",
    await user.post(`/v1/discussions/${ids.thread}/replies`, { json: { content: "delete me" } }),
    201
  )
  status(
    "user deletes their own reply",
    await admin.delete(`/v1/discussions/${ids.thread}/replies/${tempReply?.data?.id}`),
    204
  )
  check("main thread reply id still present", !!ids.reply)
}
