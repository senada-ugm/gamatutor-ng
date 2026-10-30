import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowRight,
  Award,
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  HelpCircle,
  RotateCcw,
  ThumbsUp,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { apiGet, apiSend } from "@/lib/api"
import type { TestPage, TestQuestion } from "@/lib/content/course-types"
import type { ContractQuizAttempt, ContractQuizDetail } from "@workspace/contracts/domain"

type TestMode = TestPage["mode"]

interface ClinicalQuizRunnerProps {
  mode: TestMode
  questions: TestQuestion[]
  title?: string
  intro?: string
  passingScore?: number // e.g. 0.7 (70%)
  /** The server-side quiz backing a pre or post test. When present,
   *  attempts are created, graded, and recorded through the quiz engine
   *  (visible in instructor reports); absent it — and always for a
   *  practice Evaluasi — scoring is local. */
  quizId?: string
  onComplete?: (scorePct: number, passed: boolean) => void
  /** Leave the test for the next slide: after a pre test or practice, and
   *  after a post test once the learner says they are satisfied. */
  onContinue?: () => void
  /** Post test only: go back to the start of the modules to study again. */
  onRestudy?: () => void
  className?: string
}

interface TestResult {
  scorePct: number
  passed: boolean
  correctCount: number
}

const MODE_COPY: Record<TestMode, { eyebrow: string; resultTitle: string; finish: string }> = {
  pre: { eyebrow: "PRE TEST", resultTitle: "Hasil Pre Test", finish: "Selesaikan Pre Test" },
  practice: {
    eyebrow: "EVALUASI MODUL · LATIHAN MANDIRI",
    resultTitle: "Hasil Evaluasi",
    finish: "Selesaikan Evaluasi",
  },
  post: { eyebrow: "POST TEST", resultTitle: "Hasil Post Test", finish: "Selesaikan Post Test" },
}

/**
 * One multiple-choice test, three ways (DRIVE rules, 29 Okt 2026):
 * - `pre` is taken before the modules. It never decides graduation, and
 *   its answer key stays hidden — the Post Test asks the same questions.
 * - `practice` is a module's Evaluasi: a self-check with the full
 *   explanation of every answer, never recorded.
 * - `post` decides graduation (passing score 70, unlimited retakes). The
 *   result asks whether the learner is satisfied with their score; any
 *   learner, passed or not, may retake it or restudy the modules first.
 */
export function ClinicalQuizRunner({
  mode,
  questions,
  title,
  intro,
  passingScore = 0.7,
  quizId,
  onComplete,
  onContinue,
  onRestudy,
  className = "",
}: ClinicalQuizRunnerProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<TestResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const serverQuizId = mode === "practice" ? undefined : quizId
  const copy = MODE_COPY[mode]

  // The server quiz's questions (option text, no answer key for
  // students) — used to translate the runner's letter answers into the
  // attempt payload. Question text is the join key: the deck's test
  // questions and the seeded quiz questions come from the same manifest.
  const quiz = useQuery({
    queryKey: ["quiz", serverQuizId],
    queryFn: () => apiGet<ContractQuizDetail>(`/quizzes/${serverQuizId}`),
    enabled: serverQuizId != null,
    staleTime: 5 * 60 * 1000,
  })

  const currentQ = questions[currentIndex]
  const totalCount = questions.length

  if (!currentQ) {
    return <p className="p-8 text-center text-sm text-muted-foreground">Soal belum tersedia.</p>
  }

  function handleSelect(letter: string) {
    if (result) return
    setAnswers((prev) => ({ ...prev, [currentQ.id]: letter }))
  }

  function handleNext() {
    if (currentIndex < totalCount - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      void finishQuiz()
    }
  }

  function handlePrev() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  function localResult(): TestResult {
    let correctCount = 0
    for (const q of questions) {
      if (answers[q.id] === q.correct) correctCount++
    }
    return {
      scorePct: Math.round((correctCount / totalCount) * 100),
      passed: correctCount / totalCount >= passingScore,
      correctCount,
    }
  }

  async function finishQuiz() {
    setSubmitting(true)
    try {
      let outcome = localResult()
      if (serverQuizId && quiz.data) {
        // Server-graded path: one attempt per run, unlimited retakes
        // (quiz.maxAttempts = 0). Letters map to option text via the
        // question's own options, keyed to server questions by text.
        const attempt = await apiSend<ContractQuizAttempt>("POST", `/quizzes/${serverQuizId}/attempts`)
        const payload: Record<string, string[]> = {}
        for (const q of questions) {
          const serverQuestion = quiz.data.questions.find((s) => s.question === q.question)
          if (!serverQuestion) continue
          const letter = answers[q.id]
          const text = q.options.find((o) => o.letter === letter)?.text
          if (text) payload[serverQuestion.id] = [text]
        }
        const graded = await apiSend<ContractQuizAttempt>("POST", `/quiz-attempts/${attempt.id}/submit`, {
          answers: payload,
        })
        const maxScore = graded.maxScore ?? 0
        outcome = {
          scorePct: maxScore > 0 ? Math.round(((graded.score ?? 0) / maxScore) * 100) : 0,
          passed: graded.passed === true,
          correctCount: maxScore > 0 ? Math.round(((graded.score ?? 0) / maxScore) * totalCount) : 0,
        }
      }
      setResult(outcome)
      onComplete?.(outcome.scorePct, outcome.passed)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengirim jawaban — coba lagi")
    } finally {
      setSubmitting(false)
    }
  }

  function handleRetake() {
    setAnswers({})
    setCurrentIndex(0)
    setResult(null)
  }

  if (result) {
    const { scorePct, passed, correctCount } = result
    const showKey = mode !== "pre"

    return (
      <div
        className={`mx-auto max-w-2xl animate-in space-y-6 rounded-2xl border bg-card p-6 text-center fade-in md:p-8 ${className}`}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          {mode === "post" ? <Award className="h-8 w-8" /> : <ClipboardList className="h-8 w-8" />}
        </div>

        <div className="space-y-2">
          {mode === "post" ? (
            <Badge
              variant="outline"
              className={`px-3 py-1 font-mono text-xs uppercase ${
                passed
                  ? "border-emerald-300 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                  : "border-amber-300 bg-amber-500/10 text-amber-800 dark:text-amber-300"
              }`}
            >
              {passed ? "Lulus Post Test" : "Belum Lulus"}
            </Badge>
          ) : (
            <Badge variant="outline" className="px-3 py-1 font-mono text-xs uppercase">
              Tidak menentukan kelulusan
            </Badge>
          )}
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{copy.resultTitle}</h2>
          <p className="text-sm text-muted-foreground">
            Anda memperoleh nilai <strong className="text-foreground">{scorePct}</strong> ({correctCount} dari{" "}
            {totalCount} soal dijawab dengan benar).
            {mode === "post" ? ` Nilai minimal kelulusan adalah ${Math.round(passingScore * 100)}.` : null}
            {mode === "pre" ? " Pembahasan soal dapat Anda lihat setelah mengerjakan Post Test." : null}
          </p>
        </div>

        <div className="space-y-3 rounded-xl border bg-muted/20 p-4 text-left">
          <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {showKey ? "Pembahasan Soal" : "Ringkasan Jawaban"}
          </h4>
          <div className="space-y-2">
            {questions.map((q, idx) => {
              const userAns = answers[q.id]
              const isCorrect = userAns === q.correct

              return (
                <div
                  key={q.id}
                  className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs ${
                    isCorrect
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-300"
                      : "border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-300"
                  }`}
                >
                  {isCorrect ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  )}
                  <div className="flex-1 space-y-1">
                    <p className="font-semibold">
                      {idx + 1}. {q.question}
                    </p>
                    <p className="opacity-90">
                      Jawaban Anda: <strong>{userAns || "Belum dijawab"}</strong>
                      {showKey ? (
                        <>
                          {" "}
                          • Kunci Jawaban: <strong>{q.correct}</strong>
                        </>
                      ) : null}
                    </p>
                    {showKey && !isCorrect ? (
                      // The deck's explanation carries the slide notes' full
                      // REFERENSI / DAFTAR SINGKATAN after the answer; only the
                      // answer reasoning belongs in this card.
                      <p className="mt-1 text-[11px] whitespace-pre-line italic">
                        {q.explanation.split(/\n\s*REFERENSI:/)[0].trim()}
                      </p>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {mode === "post" ? (
          <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-left">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 shrink-0 text-primary" />
              <span className="text-sm font-bold text-foreground">Apakah Anda sudah puas dengan nilai Anda?</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {passed
                ? "Anda sudah lulus. Jika ingin memperbaiki nilai, Anda boleh mengulang Post Test atau mempelajari ulang modul terlebih dahulu. Sertifikat dapat diklaim di halaman Selesai."
                : `Nilai Anda belum mencapai ${Math.round(passingScore * 100)}. Anda boleh mengulang Post Test tanpa batas, atau mempelajari ulang modul terlebih dahulu.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={onContinue} className="gap-2 font-semibold">
                <ThumbsUp className="h-4 w-4" />
                Ya, sudah puas
              </Button>
              <Button variant="outline" onClick={handleRetake} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Belum, ulangi Post Test
              </Button>
              {onRestudy ? (
                <Button variant="outline" onClick={onRestudy} className="gap-2">
                  <BookOpenCheck className="h-4 w-4" />
                  Pelajari ulang modul
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {mode === "practice" ? (
              <Button variant="outline" onClick={handleRetake} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Ulangi Evaluasi
              </Button>
            ) : null}
            {onContinue ? (
              <Button onClick={onContinue} className="gap-2 font-semibold">
                Lanjut
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        )}
      </div>
    )
  }

  const selectedLetter = answers[currentQ.id]
  const isCurrentAnswered = !!selectedLetter

  return (
    <div className={`mx-auto max-w-2xl space-y-6 rounded-2xl border bg-card p-6 shadow-xs md:p-8 ${className}`}>
      {/* Header and Progress */}
      <div className="space-y-3 border-b pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="font-mono text-xs font-bold text-primary">{copy.eyebrow}</span>
            <h3 className="mt-0.5 text-lg font-bold text-foreground">
              {title ? `${title} · ` : ""}Soal {currentIndex + 1} dari {totalCount}
            </h3>
          </div>

          <Badge variant="outline" className="shrink-0 font-mono text-xs">
            {Math.round(((currentIndex + 1) / totalCount) * 100)}%
          </Badge>
        </div>
        {intro && currentIndex === 0 ? <p className="text-sm text-muted-foreground">{intro}</p> : null}
      </div>

      {/* Question Text */}
      <div className="space-y-3">
        <h4 className="text-base leading-relaxed font-semibold text-foreground">{currentQ.question}</h4>
      </div>

      {/* Options List */}
      <div className="space-y-2.5">
        {currentQ.options.map((opt) => {
          const isSelected = selectedLetter === opt.letter

          return (
            <button
              key={opt.letter}
              type="button"
              onClick={() => handleSelect(opt.letter)}
              className={`flex w-full cursor-pointer items-start gap-3.5 rounded-xl border p-4 text-left text-xs leading-relaxed shadow-xs transition-all sm:text-sm ${
                isSelected
                  ? "border-primary bg-primary/10 font-semibold ring-2 ring-primary/40"
                  : "border-border bg-background hover:border-primary/50"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {opt.letter}
              </span>
              <span className="mt-0.5 flex-1">{opt.text}</span>
            </button>
          )
        })}
      </div>

      {/* Nav Controls */}
      <div className="flex items-center justify-between border-t pt-4">
        <Button size="sm" variant="outline" disabled={currentIndex === 0} onClick={handlePrev}>
          Sebelumnya
        </Button>

        <Button
          size="sm"
          disabled={!isCurrentAnswered || submitting}
          onClick={handleNext}
          className="gap-1.5 font-semibold"
        >
          <span>{submitting ? "Menilai..." : currentIndex === totalCount - 1 ? copy.finish : "Soal Berikutnya"}</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
