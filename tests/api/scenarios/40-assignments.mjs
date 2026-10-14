import { check, eq, status } from "../lib/assert.mjs"

/**
 * Assignments: authoring, the learner submission lifecycle (submit ->
 * graded -> returned -> resubmit), and the overwrite-until-graded rule.
 * The assignment itself is deleted last (cascade removes submissions).
 */
export async function run(ctx) {
  console.log("\n== Assignments ==")
  const { admin, user, anon, ids } = ctx

  const created = status(
    "admin creates an assignment",
    await admin.post(`/v1/courses/${ids.course}/assignments`, {
      json: { title: "Journey Assignment", maxScore: 100, allowLateSubmission: true },
    }),
    201
  )
  ids.assignment = created?.data?.id

  status("admin lists the course's assignments", await admin.get(`/v1/courses/${ids.course}/assignments`), 200)
  status(
    "admin updates the assignment",
    await admin.patch(`/v1/assignments/${ids.assignment}`, { json: { title: "Journey Assignment (renamed)" } }),
    200
  )
  status("admin fetches the assignment detail", await admin.get(`/v1/assignments/${ids.assignment}`), 200)

  const submission = status(
    "user submits their work",
    await user.post(`/v1/assignments/${ids.assignment}/submissions`, { json: { content: "My journey submission" } }),
    201
  )
  ids.submission = submission?.data?.id
  status(
    "anon cannot submit",
    await anon.post(`/v1/assignments/${ids.assignment}/submissions`, { json: { content: "x" } }),
    401
  )

  const submissions = status(
    "admin lists the assignment's submissions",
    await admin.get(`/v1/assignments/${ids.assignment}/submissions`),
    200
  )
  check(
    "submission appears in the manager list",
    submissions?.data?.some((s) => s.id === ids.submission)
  )
  const single = status(
    "admin fetches the submission by id",
    await admin.get(`/v1/assignment-submissions/${ids.submission}`),
    200
  )
  eq("submission content persisted", single?.data?.content, "My journey submission")

  const graded = status(
    "admin grades the submission",
    await admin.post(`/v1/assignment-submissions/${ids.submission}/grade`, { json: { score: 88, feedback: "nice" } }),
    200
  )
  eq("status is graded", graded?.data?.status, "graded")
  const blocked = status(
    "resubmitting after grading is rejected",
    await user.post(`/v1/assignments/${ids.assignment}/submissions`, { json: { content: "redo" } }),
    409
  )
  check("409 explains the reopen rule", /reopen/i.test(blocked?.error?.message ?? ""), blocked?.error?.message)

  status("admin returns the submission", await admin.post(`/v1/assignment-submissions/${ids.submission}/return`), 200)
  const redone = status(
    "user resubmits after return",
    await user.post(`/v1/assignments/${ids.assignment}/submissions`, { json: { content: "Journey submission v2" } }),
    201
  )
  eq("prior grade cleared on resubmit", redone?.data?.score, undefined)
  eq("resubmission content replaced", redone?.data?.content, "Journey submission v2")

  const submissionCount = status(
    "assignment reports aggregated submission counts",
    await admin.get(`/v1/courses/${ids.course}/assignments`),
    200
  )
  check(
    "submission counts are aggregated",
    submissionCount?.data?.every((a) => typeof a.submissionCount === "number")
  )

  status("admin deletes the assignment", await admin.delete(`/v1/assignments/${ids.assignment}`), 204)
  status("deleted assignment 404s", await admin.get(`/v1/assignments/${ids.assignment}`), 404)

  // late submissions: accepted, flagged, and penalized at grading time
  const lateAssignment = status(
    "admin creates a late-penalty assignment (due yesterday)",
    await admin.post(`/v1/courses/${ids.course}/assignments`, {
      json: {
        title: "Journey Late Assignment",
        maxScore: 100,
        dueDate: "2020-01-01T00:00:00.000Z",
        allowLateSubmission: true,
        lateSubmissionPenalty: 20,
      },
    }),
    201
  )
  const lateSub = status(
    "user submits late (accepted via allowLateSubmission)",
    await user.post(`/v1/assignments/${lateAssignment?.data?.id}/submissions`, {
      json: { content: "late but accepted" },
    }),
    201
  )
  check("submission flagged late", lateSub?.data?.isLate === true)
  const lateGraded = status(
    "admin grades the late submission",
    await admin.post(`/v1/assignment-submissions/${lateSub?.data?.id}/grade`, {
      json: { score: 100, feedback: "penalty applied" },
    }),
    200
  )
  eq("penalty applied: 100 - 20% = 80", lateGraded?.data?.score, 80)
  status(
    "score above maxScore is rejected",
    await admin.post(`/v1/assignment-submissions/${lateSub?.data?.id}/grade`, { json: { score: 999 } }),
    400
  )
}
