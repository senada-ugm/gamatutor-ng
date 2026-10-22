import { check, eq, status } from "../lib/assert.mjs"

/**
 * Certificates: graduating an enrollment auto-issues the certificate
 * server-side; the by-id read is scoped (recipient/admin/manager) while
 * code verification stays public; re-issuing is idempotent. A
 * participant who passed the post-test may self-claim (graduate).
 */
export async function run(ctx) {
  console.log("\n== Certificates ==")
  const { admin, owner, user, anon, ids } = ctx

  // certificate settings ride the same domain — configure then verify
  status(
    "admin updates the course's certificate signatures",
    await admin.patch(`/v1/courses/${ids.course}/certificate-settings`, {
      json: { signatures: [{ id: 1, name: "Dr. Journey", title: "Director", placement: "center" }] },
    }),
    200
  )
  const settings = status(
    "anon reads the certificate settings shape",
    await anon.get(`/v1/courses/${ids.course}/certificate-settings`),
    401
  )

  // self-claim: a participant graduates themselves once the post-test
  // is passed — refused before that, then issued without an admin
  const claimBody = { json: { enrollmentId: ids.enrollmentUser } }
  status(
    "user cannot self-claim before passing the post-test",
    await user.post(`/v1/courses/${ids.course}/certificates`, claimBody),
    403
  )
  const postTest = status(
    "admin creates a post-test",
    await admin.post(`/v1/courses/${ids.course}/quizzes`, { json: { title: "Journey Post-test" } }),
    201
  )
  const postTestQuestion = status(
    "admin adds a post-test question",
    await admin.post(`/v1/quizzes/${postTest?.data?.id}/questions`, {
      json: {
        question: "Best HTTP status for success?",
        questionType: "single_choice",
        options: [{ text: "200" }, { text: "500" }],
        correctAnswers: ["200"],
        points: 10,
      },
    }),
    201
  )
  const postTestAttempt = status(
    "user starts the post-test",
    await user.post(`/v1/quizzes/${postTest?.data?.id}/attempts`),
    201
  )
  const passedAttempt = status(
    "user passes the post-test",
    await user.post(`/v1/quiz-attempts/${postTestAttempt?.data?.id}/submit`, {
      json: { answers: { [postTestQuestion?.data?.id]: ["200"] } },
    }),
    200
  )
  check("post-test attempt passed", passedAttempt?.data?.passed === true)
  const selfClaimed = status(
    "user self-claims the certificate after passing",
    await user.post(`/v1/courses/${ids.course}/certificates`, claimBody),
    201
  )
  eq("self-claim certificate belongs to the user's enrollment", selfClaimed?.data?.enrollmentId, ids.enrollmentUser)
  status("admin deletes the post-test", await admin.delete(`/v1/quizzes/${postTest?.data?.id}`), 204)

  const graduated = status(
    "admin graduates the user's enrollment",
    await admin.patch(`/v1/enrollments/${ids.enrollmentUser}`, { json: { status: "graduated" } }),
    200
  )
  ids.certificate = graduated?.data?.certificateId
  check("graduation auto-issued a certificate", !!ids.certificate)
  eq("re-graduating keeps the self-claimed certificate", ids.certificate, selfClaimed?.data?.id)
  check("enrollment flags certificateIssued", graduated?.data?.certificateIssued === true)

  const issued = status(
    "admin re-issues for the same enrollment (idempotent)",
    await admin.post(`/v1/courses/${ids.course}/certificates`, { json: { enrollmentId: ids.enrollmentUser } }),
    201
  )
  eq("re-issue returns the same certificate", issued?.data?.id, ids.certificate)

  // by-id scoping: recipient + admin ok, other-role 403, anon 401
  status("recipient reads the certificate", await user.get(`/v1/certificates/${ids.certificate}`), 200)
  status("admin reads the certificate", await admin.get(`/v1/certificates/${ids.certificate}`), 200)
  status(
    "owner of an unrelated institution cannot read it",
    await owner.get(`/v1/certificates/${ids.certificate}`),
    403
  )
  status("anon cannot read it by id", await anon.get(`/v1/certificates/${ids.certificate}`), 401)

  // public verification stays open — the QR-link flow
  const cert = status(
    "recipient re-reads for the verification code",
    await user.get(`/v1/certificates/${ids.certificate}`),
    200
  )
  ids.verificationCode = cert?.data?.verificationCode
  check("verification code format", /^SKR-/.test(ids.verificationCode ?? ""))
  const verified = status(
    "anon verifies by code",
    await anon.get(`/v1/certificates/verify?code=${ids.verificationCode}`),
    200
  )
  eq("verified certificate matches", verified?.data?.id, ids.certificate)
  check(
    "settings signatures flow into the certificate render data",
    (verified?.data?.course?.certificateSignatures?.length ?? 0) >= 1
  )

  // deletion guard: a certified enrollment is a permanent record
  status("deleting a certified enrollment is refused", await admin.delete(`/v1/enrollments/${ids.enrollmentUser}`), 409)
  const graduatedCourse = status("course detail after graduation", await admin.get(`/v1/courses/${ids.course}`), 200)
  eq("participantCount includes the graduate", graduatedCourse?.data?.participantCount, 2)
}
