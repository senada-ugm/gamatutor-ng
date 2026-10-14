import type {
  Quiz,
  QuizAttempt,
  QuizAttemptGrade,
  QuizAttemptSubmit,
  QuizCreate,
  QuizDetail,
  QuizQuestion,
  QuizQuestionCreate,
  QuizQuestionUpdate,
  QuizUpdate,
} from "@workspace/contracts"
import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm"
import { db } from "../../../db/index.js"
import { quizAttempts, quizQuestions, quizzes } from "../../../db/app-schema.js"
import { users as userTable } from "../../../db/auth-schema.js"
import { ConflictError, ForbiddenError, NotFoundError } from "../../../lib/errors.js"
import { generateId } from "../../../lib/response.js"

type QuizRow = typeof quizzes.$inferSelect
type QuestionRow = typeof quizQuestions.$inferSelect
type AttemptRow = typeof quizAttempts.$inferSelect

/** Question counts for many quizzes in one grouped query — the list
 *  endpoints embed the count per quiz, so per-quiz COUNT queries would
 *  be an N+1 storm. */
async function countQuestionsBatch(quizIds: string[]): Promise<Map<string, number>> {
  if (quizIds.length === 0) return new Map()
  const rows = await db
    .select({ quizId: quizQuestions.quizId, count: sql<number>`count(*)::int` })
    .from(quizQuestions)
    .where(inArray(quizQuestions.quizId, quizIds))
    .groupBy(quizQuestions.quizId)
  return new Map(rows.map((r) => [r.quizId, r.count]))
}

/** True once the user has submitted at least one attempt at this quiz -
 *  used to decide whether a student may see correctAnswers per
 *  Quiz.showCorrectAnswers, without granting course-management rights.
 *  An `expired` attempt (started, never submitted) does NOT unlock the
 *  answer key. */
export async function hasCompletedAttempt(quizId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ status: quizAttempts.status })
    .from(quizAttempts)
    .where(and(eq(quizAttempts.quizId, quizId), eq(quizAttempts.userId, userId)))
  return rows.some((r) => r.status === "graded" || r.status === "pending_review" || r.status === "submitted")
}

function toQuiz(row: QuizRow, questionCount: number): Quiz {
  return {
    id: row.id,
    courseId: row.courseId ?? undefined,
    lessonId: row.lessonId ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    passingScore: row.passingScore,
    maxAttempts: row.maxAttempts,
    timeLimit: row.timeLimit ?? undefined,
    shuffleQuestions: row.shuffleQuestions,
    shuffleOptions: row.shuffleOptions,
    showResults: row.showResults,
    showCorrectAnswers: row.showCorrectAnswers,
    questionCount,
    createdAt: row.createdAt.toISOString(),
  }
}

function toQuestion(row: QuestionRow, includeAnswers: boolean): QuizQuestion {
  return {
    id: row.id,
    quizId: row.quizId,
    question: row.question,
    questionType: row.questionType as QuizQuestion["questionType"],
    options: row.options as QuizQuestion["options"],
    correctAnswers: includeAnswers ? row.correctAnswers : undefined,
    points: row.points,
    explanation: row.explanation ?? undefined,
    displayOrder: row.displayOrder,
    category: row.category ?? undefined,
    optionWeights: includeAnswers ? (row.optionWeights ?? undefined) : undefined,
  }
}

export async function getQuizRow(id: string): Promise<QuizRow> {
  const [row] = await db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.id, id), isNull(quizzes.deletedAt)))
    .limit(1)
  if (!row) throw new NotFoundError("Quiz", id)
  return row
}

export async function listQuizzes(courseId: string): Promise<Quiz[]> {
  const rows = await db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.courseId, courseId), isNull(quizzes.deletedAt)))
  const counts = await countQuestionsBatch(rows.map((r) => r.id))
  return rows.map((row) => toQuiz(row, counts.get(row.id) ?? 0))
}

/** Standalone (course-less) quizzes — assessments. Same query shape as
 *  listQuizzes, just filtered by courseId IS NULL instead of a course. */
export async function listAssessments(): Promise<Quiz[]> {
  const rows = await db
    .select()
    .from(quizzes)
    .where(and(isNull(quizzes.courseId), isNull(quizzes.deletedAt)))
  const counts = await countQuestionsBatch(rows.map((r) => r.id))
  return rows.map((row) => toQuiz(row, counts.get(row.id) ?? 0))
}

export async function createQuiz(courseId: string | null, input: QuizCreate): Promise<Quiz> {
  const [row] = await db
    .insert(quizzes)
    .values({
      id: generateId("qz"),
      courseId,
      lessonId: input.lessonId,
      title: input.title,
      description: input.description,
      passingScore: input.passingScore ?? 70,
      maxAttempts: input.maxAttempts ?? 1,
      timeLimit: input.timeLimit,
      shuffleQuestions: input.shuffleQuestions ?? false,
      shuffleOptions: input.shuffleOptions ?? false,
      showResults: input.showResults ?? true,
      showCorrectAnswers: input.showCorrectAnswers ?? false,
    })
    .returning()
  return toQuiz(row!, 0)
}

export async function getQuizDetail(id: string, includeAnswers: boolean): Promise<QuizDetail> {
  const row = await getQuizRow(id)
  const questionRows = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, id))
    .orderBy(quizQuestions.displayOrder)
  return { ...toQuiz(row, questionRows.length), questions: questionRows.map((q) => toQuestion(q, includeAnswers)) }
}

export async function updateQuiz(id: string, input: QuizUpdate): Promise<Quiz> {
  await getQuizRow(id)
  const [row] = await db.update(quizzes).set(input).where(eq(quizzes.id, id)).returning()
  const counts = await countQuestionsBatch([row!.id])
  return toQuiz(row!, counts.get(row!.id) ?? 0)
}

export async function deleteQuiz(id: string): Promise<void> {
  await getQuizRow(id)
  await db.update(quizzes).set({ deletedAt: new Date() }).where(eq(quizzes.id, id))
}

export async function getQuestionRow(id: string): Promise<QuestionRow> {
  const [row] = await db.select().from(quizQuestions).where(eq(quizQuestions.id, id)).limit(1)
  if (!row) throw new NotFoundError("QuizQuestion", id)
  return row
}

export async function createQuestion(quizId: string, input: QuizQuestionCreate): Promise<QuizQuestion> {
  await getQuizRow(quizId)
  const [row] = await db
    .insert(quizQuestions)
    .values({
      id: generateId("qzq"),
      quizId,
      question: input.question,
      questionType: input.questionType,
      options: (input.options ?? []) as QuestionRow["options"],
      correctAnswers: (input.correctAnswers ?? []) as string[],
      points: input.points ?? 10,
      explanation: input.explanation,
      displayOrder: input.displayOrder ?? 0,
      category: input.category,
      optionWeights: input.optionWeights,
    })
    .returning()
  return toQuestion(row!, true)
}

export async function updateQuestion(id: string, input: QuizQuestionUpdate): Promise<QuizQuestion> {
  const question = await getQuestionRow(id)
  // Once any attempt exists, the answer key and scoring are frozen —
  // editing correctAnswers/points after submissions would regrade the
  // world retroactively. Question text/explanation stay editable.
  const touchesProtected =
    input.correctAnswers !== undefined ||
    input.points !== undefined ||
    input.optionWeights !== undefined ||
    input.questionType !== undefined ||
    input.options !== undefined
  if (touchesProtected) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(quizAttempts)
      .where(eq(quizAttempts.quizId, question.quizId))
    if ((row?.count ?? 0) > 0) {
      throw new ConflictError(
        "This quiz already has attempts — its answer key and scoring are locked (question text and explanation stay editable)"
      )
    }
  }

  const patch: Partial<QuestionRow> = {}
  if (input.question !== undefined) patch.question = input.question
  if (input.questionType !== undefined) patch.questionType = input.questionType
  if (input.options !== undefined) patch.options = input.options as QuestionRow["options"]
  if (input.correctAnswers !== undefined) patch.correctAnswers = input.correctAnswers as string[]
  if (input.points !== undefined) patch.points = input.points
  if (input.explanation !== undefined) patch.explanation = input.explanation
  if (input.displayOrder !== undefined) patch.displayOrder = input.displayOrder
  if (input.category !== undefined) patch.category = input.category
  if (input.optionWeights !== undefined) patch.optionWeights = input.optionWeights
  const [row] = await db.update(quizQuestions).set(patch).where(eq(quizQuestions.id, id)).returning()
  return toQuestion(row!, true)
}

export async function deleteQuestion(id: string): Promise<void> {
  await getQuestionRow(id)
  await db.delete(quizQuestions).where(eq(quizQuestions.id, id))
}

function toAttempt(row: AttemptRow): Omit<QuizAttempt, "user"> {
  return {
    id: row.id,
    quizId: row.quizId,
    userId: row.userId,
    attemptNumber: row.attemptNumber,
    answers: row.answers as QuizAttempt["answers"],
    score: row.score ?? undefined,
    maxScore: row.maxScore ?? undefined,
    passed: row.passed ?? undefined,
    status: row.status as QuizAttempt["status"],
    startedAt: row.startedAt.toISOString(),
    submittedAt: row.submittedAt?.toISOString(),
    gradedAt: row.gradedAt?.toISOString(),
    categoryScores: row.categoryScores ?? undefined,
    reportMeta: row.reportMeta ?? undefined,
  }
}

/** Batch-joins the attempt owners' display info — the grading queue
 *  shows names next to answers (same denormalized-join pattern the
 *  discussion domain uses). */
async function attachUsers(attempts: Array<Omit<QuizAttempt, "user">>): Promise<QuizAttempt[]> {
  if (attempts.length === 0) return []
  const ids = [...new Set(attempts.map((a) => a.userId))]
  const accounts = await db.select().from(userTable).where(inArray(userTable.id, ids))
  const byId = new Map(accounts.map((a) => [a.id, a]))
  return attempts.map((a) => {
    const account = byId.get(a.userId)
    return {
      ...a,
      user: { id: a.userId, name: account?.name ?? a.userId, email: account?.email ?? "" },
    }
  })
}

export async function listMyAttempts(quizId: string, userId: string): Promise<QuizAttempt[]> {
  const rows = await db
    .select()
    .from(quizAttempts)
    .where(and(eq(quizAttempts.quizId, quizId), eq(quizAttempts.userId, userId)))
  return attachUsers(rows.map(toAttempt))
}

/** Every participant's attempts at a quiz — the essay grading queue.
 *  Route-level gating: course managers only (assertCanManageQuiz). */
export async function listAllAttempts(quizId: string): Promise<QuizAttempt[]> {
  const rows = await db.select().from(quizAttempts).where(eq(quizAttempts.quizId, quizId))
  return attachUsers(rows.map(toAttempt))
}

/** Flips the learner's never-submitted attempts whose time window has
 *  closed to `expired`. Without this, an abandoned `in_progress` attempt
 *  sat forever — consuming an attempt slot with no UI state to show for
 *  it. Runs at the natural checkpoint (the next startAttempt) rather than
 *  on a timer; untimed quizzes never expire. */
async function expireStaleAttempts(quiz: QuizRow, userId: string): Promise<void> {
  if (!quiz.timeLimit || quiz.timeLimit <= 0) return
  const cutoff = new Date(Date.now() - quiz.timeLimit * 60_000 - TIME_LIMIT_GRACE_MS)
  await db
    .update(quizAttempts)
    .set({ status: "expired" })
    .where(
      and(
        eq(quizAttempts.quizId, quiz.id),
        eq(quizAttempts.userId, userId),
        eq(quizAttempts.status, "in_progress"),
        lt(quizAttempts.startedAt, cutoff)
      )
    )
}

export async function startAttempt(quizId: string, userId: string): Promise<QuizAttempt> {
  const quiz = await getQuizRow(quizId)
  await expireStaleAttempts(quiz, userId)
  // maxAttempts === 0 means unlimited (used by assessments like RIASEC
  // that allow indefinite retakes). Expired attempts still count —
  // otherwise abandoning a started attempt would peek at questions free.
  // Claim the next attemptNumber via onConflictDoNothing against the
  // (quizId, userId, attemptNumber) unique index — concurrent starts
  // previously raced past the count check and double-inserted. On a lost
  // race, re-check the limit and retry with the freshly observed count.
  for (let round = 0; round < 3; round++) {
    const existing = await db
      .select({ attemptNumber: quizAttempts.attemptNumber })
      .from(quizAttempts)
      .where(and(eq(quizAttempts.quizId, quizId), eq(quizAttempts.userId, userId)))
    if (quiz.maxAttempts > 0 && existing.length >= quiz.maxAttempts) {
      throw new ConflictError("No attempts remaining for this quiz")
    }
    const [inserted] = await db
      .insert(quizAttempts)
      .values({
        id: generateId("qza"),
        quizId,
        userId,
        attemptNumber: existing.length + 1,
        status: "in_progress",
      })
      .onConflictDoNothing()
      .returning()
    if (inserted) return (await attachUsers([toAttempt(inserted)]))[0]!
  }
  throw new ConflictError("Could not start an attempt — too much contention, please retry")
}

export async function getAttemptRow(id: string): Promise<AttemptRow> {
  const [row] = await db.select().from(quizAttempts).where(eq(quizAttempts.id, id)).limit(1)
  if (!row) throw new NotFoundError("QuizAttempt", id)
  return row
}

export async function getAttempt(id: string): Promise<QuizAttempt> {
  return (await attachUsers([toAttempt(await getAttemptRow(id))]))[0]!
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

export function isAnswerCorrect(question: QuestionRow, given: string[]): boolean {
  const expected = question.correctAnswers
  if (question.questionType === "multiple_choice") {
    const givenSet = new Set(given)
    const expectedSet = new Set(expected)
    return givenSet.size === expectedSet.size && [...givenSet].every((v) => expectedSet.has(v))
  }
  if (question.questionType === "short_answer") {
    const value = given[0] ? normalize(given[0]) : ""
    return value.length > 0 && expected.some((a) => normalize(a) === value)
  }
  // single_choice / true_false
  return given.length === 1 && expected.includes(given[0]!)
}

const RIASEC_KEYS = new Set(["R", "I", "A", "S", "E", "C"])

/** Assessment-only: aggregates categorized questions into a 0-100
 *  per-category score - percent-correct for ordinary choice questions,
 *  weighted-average-of-optionWeights (normalized to the category's max
 *  possible weight) for `likert` questions. Categories mix freely; each
 *  question contributes to exactly one bucket. Returns undefined when no
 *  question in the quiz has a `category` set (ordinary course quizzes). */
function computeCategoryScores(
  questionRows: QuestionRow[],
  answers: Record<string, string[]>
): Record<string, number> | undefined {
  const categorized = questionRows.filter((q) => q.category)
  if (categorized.length === 0) return undefined

  const totals = new Map<string, { sum: number; max: number }>()
  for (const q of categorized) {
    const bucket = totals.get(q.category!) ?? { sum: 0, max: 0 }
    const given = answers[q.id] ?? []
    if (q.questionType === "likert") {
      const weights = q.optionWeights ?? []
      const options = q.options as Array<{ text: string }>
      const selectedIndex = options.findIndex((o) => o.text === given[0])
      const weight = selectedIndex >= 0 ? (weights[selectedIndex] ?? 0) : 0
      const maxWeight = weights.length > 0 ? Math.max(...weights) : 0
      bucket.sum += weight
      bucket.max += maxWeight
    } else {
      bucket.sum += isAnswerCorrect(q, given) ? 1 : 0
      bucket.max += 1
    }
    totals.set(q.category!, bucket)
  }

  const scores: Record<string, number> = {}
  for (const [category, { sum, max }] of totals) {
    scores[category] = max > 0 ? Math.round((sum / max) * 100) : 0
  }
  return scores
}

/** Assessment-only: when every scored category is a RIASEC letter,
 *  surface the Holland top-3 code for the result UI. Opaque to the quiz
 *  engine otherwise - other assessment types (language/skills/psych) just
 *  get categoryScores with no reportMeta. */
function computeReportMeta(categoryScores: Record<string, number> | undefined): Record<string, unknown> | undefined {
  if (!categoryScores) return undefined
  const keys = Object.keys(categoryScores)
  if (keys.length === 0 || !keys.every((k) => RIASEC_KEYS.has(k))) return undefined
  const topTypes = [...keys]
    .sort((a, b) => categoryScores[b]! - categoryScores[a]!)
    .slice(0, 3)
    .map((type) => ({ type, score: categoryScores[type]! }))
  return { topTypes }
}

/** Time limit is authored in minutes; 0/null means no limit. A submit
 *  arriving after the limit (plus a small grace that absorbs network
 *  latency between the learner's submit click and the server's clock) is
 *  rejected — the attempt stays in_progress and still counts against
 *  maxAttempts. */
export const TIME_LIMIT_GRACE_MS = 10_000

export function assertWithinTimeLimit(
  startedAt: Date,
  timeLimitMinutes: number | null | undefined,
  now: Date = new Date()
): void {
  if (timeLimitMinutes == null || timeLimitMinutes <= 0) return
  const elapsedMs = now.getTime() - startedAt.getTime()
  if (elapsedMs > timeLimitMinutes * 60_000 + TIME_LIMIT_GRACE_MS) {
    throw new ConflictError("The time limit for this quiz has already elapsed")
  }
}

export async function submitAttempt(id: string, userId: string, input: QuizAttemptSubmit): Promise<QuizAttempt> {
  const attempt = await getAttemptRow(id)
  if (attempt.userId !== userId) throw new ForbiddenError("This is not your attempt")
  if (attempt.status === "expired") throw new ConflictError("This attempt's time window has already closed")
  if (attempt.status !== "in_progress") throw new ConflictError("This attempt has already been submitted")

  const questionRows = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, attempt.quizId))
  const answers = input.answers as unknown as Record<string, string[]>

  // `likert` questions have no correct/incorrect answer - they feed
  // categoryScores instead, so they're excluded from the overall
  // score/maxScore the same way essay questions are (until graded).
  const maxScore = questionRows.reduce((sum, q) => sum + (q.questionType === "likert" ? 0 : q.points), 0)
  const hasEssay = questionRows.some((q) => q.questionType === "essay")
  const autoScore = questionRows
    .filter((q) => q.questionType !== "essay" && q.questionType !== "likert")
    .reduce((sum, q) => sum + (isAnswerCorrect(q, answers[q.id] ?? []) ? q.points : 0), 0)

  const quiz = await getQuizRow(attempt.quizId)
  assertWithinTimeLimit(attempt.startedAt, quiz.timeLimit)
  const categoryScores = computeCategoryScores(questionRows, answers)
  const patch: Partial<AttemptRow> = {
    answers,
    submittedAt: new Date(),
    maxScore,
    categoryScores,
    reportMeta: computeReportMeta(categoryScores),
  }
  if (hasEssay) {
    patch.status = "pending_review"
  } else {
    patch.status = "graded"
    patch.score = autoScore
    // maxScore === 0 means every question was likert/category-only (e.g.
    // a personality test) - there's no pass/fail concept, so it trivially
    // passes rather than always failing.
    patch.passed = maxScore === 0 ? true : (autoScore / maxScore) * 100 >= quiz.passingScore
    patch.gradedAt = new Date()
  }

  const [row] = await db.update(quizAttempts).set(patch).where(eq(quizAttempts.id, id)).returning()
  return (await attachUsers([toAttempt(row!)]))[0]!
}

/** Manager-only hard delete of an attempt — the recovery path for an
 *  abandoned/expired attempt that burned the learner's only try (or a
 *  bad-faith result). Frees the attempt number for a fresh start. */
export async function deleteAttempt(id: string): Promise<void> {
  await getAttemptRow(id)
  await db.delete(quizAttempts).where(eq(quizAttempts.id, id))
}

export async function gradeAttempt(id: string, input: QuizAttemptGrade): Promise<QuizAttempt> {
  const attempt = await getAttemptRow(id)
  if (attempt.status !== "pending_review") throw new ConflictError("This attempt is not pending review")

  const questionRows = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, attempt.quizId))
  const answers = attempt.answers as Record<string, string[]>
  const essayScores = input.scores as unknown as Record<string, number>

  const quiz = await getQuizRow(attempt.quizId)
  const totalScore = questionRows.reduce((sum, q) => {
    if (q.questionType === "likert") return sum
    if (q.questionType === "essay") {
      const awarded = essayScores[q.id] ?? 0
      return sum + Math.min(Math.max(awarded, 0), q.points)
    }
    return sum + (isAnswerCorrect(q, answers[q.id] ?? []) ? q.points : 0)
  }, 0)
  const maxScore =
    attempt.maxScore ?? questionRows.reduce((sum, q) => sum + (q.questionType === "likert" ? 0 : q.points), 0)
  const passed = maxScore === 0 ? true : (totalScore / maxScore) * 100 >= quiz.passingScore

  const [row] = await db
    .update(quizAttempts)
    .set({ status: "graded", score: totalScore, passed, gradedAt: new Date() })
    .where(eq(quizAttempts.id, id))
    .returning()
  return (await attachUsers([toAttempt(row!)]))[0]!
}
