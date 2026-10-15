import { check, eq, status } from "../lib/assert.mjs"

/**
 * Quizzes: authoring (quiz + single-choice/essay questions) and learner
 * attempts with server-side grading (essay -> pending_review -> manual
 * grade).
 */
export async function run(ctx) {
  console.log("\n== Quizzes ==")
  const { admin, user, anon, ids } = ctx

  const quiz = status(
    "admin creates a time-limited quiz",
    await admin.post(`/v1/courses/${ids.course}/quizzes`, {
      json: { title: "Journey Quiz", maxAttempts: 3, timeLimit: 5 },
    }),
    201
  )
  ids.quiz = quiz?.data?.id
  status("admin lists the course's quizzes", await admin.get(`/v1/courses/${ids.course}/quizzes`), 200)

  const mc = status(
    "admin adds a single-choice question",
    await admin.post(`/v1/quizzes/${ids.quiz}/questions`, {
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
  ids.questionMc = mc?.data?.id
  const essay = status(
    "admin adds an essay question",
    await admin.post(`/v1/quizzes/${ids.quiz}/questions`, {
      json: { question: "Explain idempotency.", questionType: "essay", points: 10 },
    }),
    201
  )
  ids.questionEssay = essay?.data?.id

  const tempQuestion = status(
    "admin adds a disposable question",
    await admin.post(`/v1/quizzes/${ids.quiz}/questions`, {
      json: { question: "temp", questionType: "true_false", correctAnswers: ["true"] },
    }),
    201
  )
  status(
    "admin updates the disposable question",
    await admin.patch(`/v1/quiz-questions/${tempQuestion?.data?.id}`, { json: { question: "temp (renamed)" } }),
    200
  )
  status(
    "admin deletes the disposable question",
    await admin.delete(`/v1/quiz-questions/${tempQuestion?.data?.id}`),
    204
  )

  const quizDetail = status("user fetches the quiz", await user.get(`/v1/quizzes/${ids.quiz}`), 200)
  check("quiz lists its questions", (quizDetail?.data?.questions?.length ?? 0) >= 2)
  check(
    "correct answers hidden from learners",
    quizDetail?.data?.questions?.every((q) => q.correctAnswers === undefined)
  )
  status(
    "admin updates the quiz settings",
    await admin.patch(`/v1/quizzes/${ids.quiz}`, { json: { title: "Journey Quiz (renamed)" } }),
    200
  )

  // attempts: start, inspect, submit (essay forces pending_review), grade
  const attempt = status("user starts an attempt", await user.post(`/v1/quizzes/${ids.quiz}/attempts`), 201)
  ids.attempt = attempt?.data?.id
  status("user lists their attempts", await user.get(`/v1/quizzes/${ids.quiz}/attempts`), 200)
  status("admin reads the attempt", await admin.get(`/v1/quiz-attempts/${ids.attempt}`), 200)
  status("anon cannot start an attempt", await anon.post(`/v1/quizzes/${ids.quiz}/attempts`), 401)

  const submitted = status(
    "user submits answers",
    await user.post(`/v1/quiz-attempts/${ids.attempt}/submit`, {
      json: { answers: { [ids.questionMc]: ["200"], [ids.questionEssay]: ["Idempotent means same result."] } },
    }),
    200
  )
  eq("essay submission lands in pending_review", submitted?.data?.status, "pending_review")

  const graded = status(
    "admin grades the essay",
    await admin.post(`/v1/quiz-attempts/${ids.attempt}/grade`, { json: { scores: { [ids.questionEssay]: 8 } } }),
    200
  )
  check("graded attempt carries a score", graded ? typeof graded.data?.score === "number" : false)

  // the quiz is deleted last: attempts/questions cascade with it
  status("admin deletes the quiz", await admin.delete(`/v1/quizzes/${ids.quiz}`), 204)
}
