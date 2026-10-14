import { check, eq, status } from "../lib/assert.mjs"

/**
 * Course instructors: invite -> roster -> role change -> removal.
 * Narrow gate: admin-or-institution-owner only for every mutation.
 */
export async function run(ctx) {
  console.log("\n== Course Instructors ==")
  const { admin, owner, user, anon, ids } = ctx
  const email = `journey.co-instructor.${ctx.stamp}@example.test`

  const invited = status(
    "admin invites a co-instructor",
    await admin.post("/v1/course-instructors", { json: { courseId: ids.course, email, role: "co_instructor" } }),
    201
  )
  ids.instructor = invited?.data?.id
  eq("invite without a matching account starts pending", invited?.data?.status, "pending")

  const list = status(
    "admin lists the course's instructors",
    await admin.get(`/v1/course-instructors?courseId=${ids.course}`),
    200
  )
  check(
    "invite appears in the course list",
    list?.data?.some((i) => i.id === ids.instructor)
  )

  status(
    "admin reads the institution instructor roster",
    await admin.get(
      `/v1/course-instructors/institution-roster?institutionId=${ids.institution}&excludeCourseId=${ids.course}`
    ),
    200
  )

  status(
    "admin promotes the invite to instructor",
    await admin.patch(`/v1/course-instructors/${ids.instructor}/role`, { json: { role: "instructor" } }),
    200
  )
  const reread = status(
    "admin re-reads the course instructors",
    await admin.get(`/v1/course-instructors?courseId=${ids.course}`),
    200
  )
  eq("role change persisted", reread?.data?.find((i) => i.id === ids.instructor)?.role, "instructor")

  // gates: plain users and owners of other institutions can't manage
  status(
    "plain user cannot invite an instructor",
    await user.post("/v1/course-instructors", { json: { courseId: ids.course, email: "x@x.test" } }),
    403
  )
  status(
    "owner of another institution cannot remove",
    await owner.delete(`/v1/course-instructors/${ids.instructor}`),
    403
  )
  status("anon cannot list instructors", await anon.get(`/v1/course-instructors?courseId=${ids.course}`), 401)

  status("admin removes the instructor", await admin.delete(`/v1/course-instructors/${ids.instructor}`), 204)
}
