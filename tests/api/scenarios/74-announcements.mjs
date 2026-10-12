import { check, eq, status } from "../lib/assert.mjs"

/**
 * Announcements: draft -> publish -> pin lifecycle, participant
 * visibility (drafts invisible), and deletion.
 */
export async function run(ctx) {
  console.log("\n== Announcements ==")
  const { admin, user, anon, ids } = ctx

  const draft = status(
    "admin drafts an announcement",
    await admin.post(`/v1/courses/${ids.course}/announcements`, {
      json: {
        courseId: ids.course,
        title: `Journey Announcement ${ctx.stamp}`,
        content: "Draft body.",
        isPublished: false,
      },
    }),
    201
  )
  const announcementId = draft?.data?.id

  const mgrList = status(
    "manager sees the draft in the course list",
    await admin.get(`/v1/courses/${ids.course}/announcements`),
    200
  )
  check(
    "draft listed for managers",
    (mgrList?.data ?? []).some((a) => a.id === announcementId)
  )
  const learnerList = status(
    "participant list hides the draft",
    await user.get(`/v1/courses/${ids.course}/announcements`),
    200
  )
  check("draft invisible to participants", !(learnerList?.data ?? []).some((a) => a.id === announcementId))
  status("anon cannot list announcements", await anon.get(`/v1/courses/${ids.course}/announcements`), 401)

  status("plain user cannot publish", await user.post(`/v1/announcements/${announcementId}/publish`), 403)
  const published = status(
    "admin publishes the announcement",
    await admin.post(`/v1/announcements/${announcementId}/publish`),
    200
  )
  eq("published flag set", published?.data?.isPublished, true)
  const pinned = status("admin pins it", await admin.post(`/v1/announcements/${announcementId}/pin`), 200)
  eq("pinned flag set", pinned?.data?.isPinned, true)
  status("admin unpins it", await admin.post(`/v1/announcements/${announcementId}/unpin`), 200)
  const learnerAfter = status("participants now see it", await user.get(`/v1/courses/${ids.course}/announcements`), 200)
  check(
    "published announcement visible",
    (learnerAfter?.data ?? []).some((a) => a.id === announcementId)
  )

  status("admin deletes the announcement", await admin.delete(`/v1/announcements/${announcementId}`), 204)
  const afterDelete = status(
    "manager re-lists after delete",
    await admin.get(`/v1/courses/${ids.course}/announcements`),
    200
  )
  check("announcement gone", !(afterDelete?.data ?? []).some((a) => a.id === announcementId))
}
