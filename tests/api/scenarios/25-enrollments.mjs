import { check, eq, status } from "../lib/assert.mjs"

/**
 * Enrollments: self-service enrollment, the workflow transitions
 * (selection; graduation happens in the certificates scenario), read
 * scoping, and the participant-profile surface.
 */
export async function run(ctx) {
  console.log("\n== Enrollments ==")
  const { admin, owner, user, anon, ids } = ctx

  // self-service enrollment
  const self = status("user self-enrolls", await user.post("/v1/enrollments", { json: { courseId: ids.course } }), 201)
  ids.enrollmentUser = self?.data?.id
  const ownerEn = status(
    "owner self-enrolls",
    await owner.post("/v1/enrollments", { json: { courseId: ids.course } }),
    201
  )
  ids.enrollmentOwner = ownerEn?.data?.id
  status("duplicate self-enroll conflicts", await user.post("/v1/enrollments", { json: { courseId: ids.course } }), 409)
  status("anon cannot enroll", await anon.post("/v1/enrollments", { json: { courseId: ids.course } }), 401)

  // registration gates: draft courses, closed windows, and quotas
  const gateInst = status(
    "admin creates a gate-test institution",
    await admin.post("/v1/institutions", {
      json: { name: `Journey Gate Inst ${ctx.stamp}`, institutionType: "universitas" },
    }),
    201
  )
  const gateInstId = gateInst?.data?.id
  const draftCourse = status(
    "admin creates a draft course under it",
    await admin.post("/v1/courses", {
      json: {
        title: `Journey Draft Course ${ctx.stamp}`,
        institutionId: gateInstId,
        courseType: "online",
        isDisabilityFriendly: false,
        supportedDisabilityTypes: [],
      },
    }),
    201
  )
  status(
    "user cannot enroll in a draft course of an institution they don't manage",
    await user.post("/v1/enrollments", { json: { courseId: draftCourse?.data?.id } }),
    409
  )
  const quotaCourse = status(
    "admin creates a quota-1 course and publishes it",
    await admin.post("/v1/courses", {
      json: {
        title: `Journey Quota Course ${ctx.stamp}`,
        institutionId: ids.institution,
        courseType: "online",
        isDisabilityFriendly: false,
        supportedDisabilityTypes: [],
        registrantQuota: 1,
      },
    }),
    201
  )
  const quotaCourseId = quotaCourse?.data?.id
  status("admin publishes the quota course", await admin.post(`/v1/courses/${quotaCourseId}/publish`), 200)
  status(
    "owner fills the quota course",
    await owner.post("/v1/enrollments", { json: { courseId: quotaCourseId } }),
    201
  )
  status(
    "user is rejected by the registration quota",
    await user.post("/v1/enrollments", { json: { courseId: quotaCourseId } }),
    409
  )
  status(
    "managers are not exempt from quotas either",
    await admin.post("/v1/enrollments", { json: { courseId: quotaCourseId } }),
    409
  )
  const windowCourse = status(
    "admin creates a closed-window course and publishes it",
    await admin.post("/v1/courses", {
      json: {
        title: `Journey Closed Course ${ctx.stamp}`,
        institutionId: ids.institution,
        courseType: "online",
        isDisabilityFriendly: false,
        supportedDisabilityTypes: [],
        registrationCloseAt: "2020-01-01T00:00:00.000Z",
      },
    }),
    201
  )
  status(
    "admin publishes the closed-window course",
    await admin.post(`/v1/courses/${windowCourse?.data?.id}/publish`),
    200
  )
  status(
    "user is rejected by the registration window",
    await user.post("/v1/enrollments", { json: { courseId: windowCourse?.data?.id } }),
    409
  )

  // The funnel: registering is not participating — the manager selects
  // before participant-gated surfaces open.
  status(
    "user is not yet an active participant",
    await user.post(`/v1/lesson-progress/${ids.lesson}/complete?courseId=${ids.course}`),
    403
  )
  status(
    "admin selects the user's enrollment",
    await admin.patch(`/v1/enrollments/${ids.enrollmentUser}`, { json: { status: "selected" } }),
    200
  )
  status(
    "admin selects the owner",
    await admin.patch(`/v1/enrollments/${ids.enrollmentOwner}`, { json: { status: "selected" } }),
    200
  )

  // lesson progress for the enrolled learner (enrollment gate satisfied)
  status(
    "user lists own lesson progress",
    await user.get(`/v1/lesson-progress?courseId=${ids.course}&userId=${ids.userId}`),
    200
  )
  const done = status(
    "user completes the lesson",
    await user.post(`/v1/lesson-progress/${ids.lesson}/complete?courseId=${ids.course}`),
    200
  )
  status(
    "re-completing is idempotent",
    await user.post(`/v1/lesson-progress/${ids.lesson}/complete?courseId=${ids.course}`),
    200
  )
  const progress = status(
    "user re-lists progress",
    await user.get(`/v1/lesson-progress?courseId=${ids.course}&userId=${ids.userId}`),
    200
  )
  eq("lesson completion persisted", progress?.data?.length, 1)
  eq("progress row references the lesson", progress?.data?.[0]?.lessonId, ids.lesson)
  status("user un-completes the lesson", await user.delete(`/v1/lesson-progress/${ids.lesson}/complete`), 204)
  status(
    "user re-completes for the journey",
    await user.post(`/v1/lesson-progress/${ids.lesson}/complete?courseId=${ids.course}`),
    200
  )
  check("completion row id is stable", done ? !!done.data?.id : false)

  // read scoping
  status("user lists own enrollments", await user.get("/v1/enrollments"), 200)
  status("user cannot read the owner's enrollment", await user.get(`/v1/enrollments/${ids.enrollmentOwner}`), 403)
  status("anon cannot list enrollments", await anon.get("/v1/enrollments"), 401)
  const mgr = status(
    "admin lists the course's enrollments",
    await admin.get(`/v1/enrollments?courseId=${ids.course}`),
    200
  )
  check("both self-enrollments visible to the manager", (mgr?.data?.length ?? 0) >= 2)

  // workflow already walked above; re-assert the selected state + counters
  const selected = status(
    "admin re-reads the user's enrollment",
    await admin.get(`/v1/enrollments/${ids.enrollmentUser}`),
    200
  )
  eq("status is selected", selected?.data?.status, "selected")
  const withCounts = status("course detail reports live counters", await admin.get(`/v1/courses/${ids.course}`), 200)
  eq("registrantCount is live", withCounts?.data?.registrantCount, 2)
  eq("participantCount is live", withCounts?.data?.participantCount, 2)
  status(
    "user cannot transition someone else's enrollment",
    await user.patch(`/v1/enrollments/${ids.enrollmentOwner}`, { json: { status: "failed" } }),
    403
  )

  // participant profile surface
  const profile = status(
    "admin reads the participant profile",
    await admin.get(`/v1/participant-profiles/${ids.userId}`),
    200
  )
  eq("profile id matches the account", profile?.data?.id, ids.userId)

  // disposable enrollment for the DELETE op
  const disposable = status(
    "admin self-enrolls (disposable)",
    await admin.post("/v1/enrollments", { json: { courseId: ids.course } }),
    201
  )
  status("admin deletes the disposable enrollment", await admin.delete(`/v1/enrollments/${disposable?.data?.id}`), 204)
  status("deleted enrollment is gone", await admin.get(`/v1/enrollments/${disposable?.data?.id}`), 404)
}
