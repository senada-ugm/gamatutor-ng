import { check, eq, status } from "../lib/assert.mjs"

/**
 * Course content: module/lesson authoring (course-management only) and
 * the lesson-progress surface — including the required courseId query
 * validation and manager-bypass on progress writes.
 */
export async function run(ctx) {
  console.log("\n== Course Content ==")
  const { admin, anon, ids } = ctx

  // modules
  const module = status(
    "admin creates a module",
    await admin.post(`/v1/courses/${ids.course}/modules`, { json: { title: "Journey Module 1" } }),
    201
  )
  ids.module = module?.data?.id
  const tempModule = status(
    "admin creates a disposable module",
    await admin.post(`/v1/courses/${ids.course}/modules`, { json: { title: "Journey Module 2 (temp)" } }),
    201
  )
  status(
    "admin updates the module",
    await admin.patch(`/v1/modules/${ids.module}`, { json: { title: "Journey Module 1 (renamed)" } }),
    200
  )
  status("admin deletes the disposable module", await admin.delete(`/v1/modules/${tempModule?.data?.id}`), 204)
  status(
    "anon cannot create a module",
    await anon.post(`/v1/courses/${ids.course}/modules`, { json: { title: "nope" } }),
    401
  )

  // lessons
  const lesson = status(
    "admin creates a lesson",
    await admin.post(`/v1/modules/${ids.module}/lessons`, { json: { title: "Journey Lesson 1" } }),
    201
  )
  ids.lesson = lesson?.data?.id
  const tempLesson = status(
    "admin creates a disposable lesson",
    await admin.post(`/v1/modules/${ids.module}/lessons`, { json: { title: "Journey Lesson 2 (temp)" } }),
    201
  )
  status(
    "admin updates the lesson",
    await admin.patch(`/v1/lessons/${ids.lesson}`, { json: { title: "Journey Lesson 1 (renamed)" } }),
    200
  )
  status("admin deletes the disposable lesson", await admin.delete(`/v1/lessons/${tempLesson?.data?.id}`), 204)

  // lesson-progress: the courseId query param is required by the contract
  status(
    "missing courseId is a 400 validation error",
    await admin.post(`/v1/lesson-progress/${ids.lesson}/complete`),
    400
  )
  status("anon cannot read progress", await anon.get(`/v1/lesson-progress?courseId=${ids.course}&userId=x`), 401)

  // manager bypasses the enrollment gate on progress writes
  const done = status(
    "admin (manager) marks the lesson complete",
    await admin.post(`/v1/lesson-progress/${ids.lesson}/complete?courseId=${ids.course}`),
    200
  )
  check("completion carries an id", !!done?.data?.id)

  // telemetry events
  status(
    "admin records a telemetry event",
    await admin.post("/v1/telemetry/events", {
      json: {
        courseId: ids.course,
        moduleId: ids.module,
        slideId: "slide-1",
        eventType: "slide_view",
        dwellTimeSeconds: 15,
      },
    }),
    201
  )
  status(
    "anon cannot record telemetry",
    await anon.post("/v1/telemetry/events", {
      json: {
        courseId: ids.course,
        moduleId: ids.module,
        slideId: "slide-1",
        eventType: "slide_view",
      },
    }),
    401
  )
}
