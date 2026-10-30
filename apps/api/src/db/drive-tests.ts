/**
 * The DRIVE deck's server-side tests, shared by seed.ts (first build) and
 * sync-drive-deck.ts (every deploy). Since the 29 Okt 2026 restructure the
 * deck carries one question set on its Post Test page (`type: "test"`,
 * `mode: "post"`); the Pre Test asks the same questions (DRIVE rule), so
 * both server quizzes are built from that page:
 * - post test → slide_decks.post_test_quiz_id: decides graduation and the
 *   certificate (passing score 70, unlimited attempts);
 * - pre test → slide_decks.pre_test_quiz_id: recorded for the pre/post
 *   comparison only. Its passing score is 0 and nothing reads its result
 *   for graduation (certificates.service only looks at the post test).
 */
import { and, eq } from "drizzle-orm"
import { db } from "./index.js"
import { quizQuestions, slideDecks } from "./app-schema.js"
import { createQuestion, createQuiz } from "../modules/quizzes/services/quizzes.service.js"

interface DeckQuestion {
  question: string
  options: Array<{ letter: string; text: string }>
  correct: string
  explanation?: string
}

/** The Post Test page's questions; the pre-restructure deck kept them as
 *  one `quiz` page each in the `evaluasi` module. */
export function deckTestQuestions(manifest: Record<string, unknown>): DeckQuestion[] {
  const modules = (manifest.modules as Array<{ id: string; pages: Array<Record<string, unknown>> }>) ?? []
  const pages = modules.flatMap((m) => m.pages ?? [])
  const post = pages.find((p) => p.type === "test" && p.mode === "post")
  if (post) return (post.questions as DeckQuestion[]) ?? []
  return (modules.find((m) => m.id === "evaluasi")?.pages ?? []).filter(
    (p) => p.type === "quiz"
  ) as unknown as DeckQuestion[]
}

async function buildQuiz(
  courseId: string,
  questions: DeckQuestion[],
  meta: { title: string; description: string; passingScore: number; showCorrectAnswers: boolean }
): Promise<string> {
  const quiz = await createQuiz(courseId, {
    ...meta,
    maxAttempts: 0,
    timeLimit: 0,
    shuffleQuestions: false,
    shuffleOptions: false,
    showResults: true,
  })
  for (const [index, q] of questions.entries()) {
    const correctText = q.options.find((o) => o.letter === q.correct)?.text ?? ""
    await createQuestion(quiz.id, {
      question: q.question,
      questionType: "single_choice",
      options: q.options.map((o) => ({ text: o.text })),
      correctAnswers: [correctText],
      points: Math.round(100 / questions.length),
      explanation: q.explanation ?? undefined,
      displayOrder: index,
    })
  }
  return quiz.id
}

/** Creates whichever of the deck's two test quizzes is missing and links
 *  it. Idempotent: an existing link is never replaced, since past attempts
 *  were graded against that quiz. */
export async function ensureDriveTestQuizzes(
  courseId: string,
  manifest: Record<string, unknown>
): Promise<{ postTestQuizId: string | null; preTestQuizId: string | null }> {
  const [deck] = await db.select().from(slideDecks).where(eq(slideDecks.courseId, courseId)).limit(1)
  if (!deck) return { postTestQuizId: null, preTestQuizId: null }
  const questions = deckTestQuestions(manifest)
  let { postTestQuizId, preTestQuizId } = deck
  if (questions.length === 0) return { postTestQuizId, preTestQuizId }

  if (!postTestQuizId) {
    postTestQuizId = await buildQuiz(courseId, questions, {
      title: "Post Test — DRIVE",
      description:
        "Post Test di akhir pelatihan; menentukan kelulusan. Nilai minimal 70; boleh diulang tanpa batas. Soalnya sama dengan Pre Test.",
      passingScore: 70,
      showCorrectAnswers: true,
    })
    await db.update(slideDecks).set({ postTestQuizId }).where(eq(slideDecks.id, deck.id))
    console.log(`  → post-test quiz linked to DRIVE deck (${questions.length} questions, ${postTestQuizId})`)
  }
  if (!preTestQuizId) {
    preTestQuizId = await buildQuiz(courseId, questions, {
      title: "Pre Test — DRIVE",
      description:
        "Pre Test sebelum materi; tidak menentukan kelulusan. Soalnya sama dengan Post Test, untuk membandingkan nilai sebelum dan sesudah pelatihan.",
      passingScore: 0,
      // Same questions as the post test: keep the key hidden.
      showCorrectAnswers: false,
    })
    await db.update(slideDecks).set({ preTestQuizId }).where(eq(slideDecks.id, deck.id))
    console.log(`  → pre-test quiz linked to DRIVE deck (${questions.length} questions, ${preTestQuizId})`)
  }
  return { postTestQuizId, preTestQuizId }
}

/** Refreshes both quizzes' explanations from the deck in place. Questions,
 *  options and answer keys are left alone: past attempts were graded
 *  against them. Returns how many question rows were touched. */
export async function refreshDriveTestExplanations(
  quizIds: Array<string | null>,
  manifest: Record<string, unknown>
): Promise<number> {
  let updated = 0
  for (const quizId of quizIds) {
    if (!quizId) continue
    for (const q of deckTestQuestions(manifest)) {
      const rows = await db
        .update(quizQuestions)
        .set({ explanation: q.explanation ?? null })
        .where(and(eq(quizQuestions.quizId, quizId), eq(quizQuestions.question, q.question)))
        .returning({ id: quizQuestions.id })
      updated += rows.length
    }
  }
  return updated
}
