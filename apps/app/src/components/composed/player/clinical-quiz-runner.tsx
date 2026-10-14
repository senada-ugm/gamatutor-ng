import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Award, CheckCircle2, RotateCcw, XCircle, ArrowRight, HelpCircle, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { apiGet, apiSend } from "@/lib/api"
import type { QuizPage } from "@/lib/content/course-types"
import type { ContractQuizAttempt, ContractQuizDetail } from "@workspace/contracts/domain"

interface ClinicalQuizRunnerProps {
  questions: QuizPage[]
  passingScore?: number // e.g. 0.6 or 0.7 (70%)
  /** The server-side quiz backing this post-test. When present, attempts
   *  are created, graded, and recorded through the quiz engine (visible
   *  in instructor reports); absent it, scoring falls back to local
   *  evaluation for decks without a linked quiz. */
  quizId?: string
  onComplete?: (scorePct: number, passed: boolean) => void
  onRetake?: () => void
  onClaimCertificate?: () => void
  className?: string
}

interface PostTestResult {
  scorePct: number
  passed: boolean
  correctCount: number
}

export function ClinicalQuizRunner({
  questions,
  passingScore = 0.7,
  quizId,
  onComplete,
  onRetake,
  onClaimCertificate,
  className = "",
}: ClinicalQuizRunnerProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<PostTestResult | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // The server quiz's questions (option text, no answer key for
  // students) — used to translate the runner's letter answers into the
  // attempt payload. Question text is the join key: the deck's quiz
  // pages and the seeded quiz questions come from the same manifest.
  const quiz = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: () => apiGet<ContractQuizDetail>(`/quizzes/${quizId}`),
    enabled: quizId != null,
    staleTime: 5 * 60 * 1000,
  })

  const currentQ = questions[currentIndex]
  const totalCount = questions.length

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

  function localResult(): PostTestResult {
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
      if (quizId && quiz.data) {
        // Server-graded path: one attempt per run, unlimited retakes
        // (quiz.maxAttempts = 0). Letters map to option text via the
        // page's own options, keyed to server questions by question text.
        const attempt = await apiSend<ContractQuizAttempt>("POST", `/quizzes/${quizId}/attempts`)
        const payload: Record<string, string[]> = {}
        for (const page of questions) {
          const serverQuestion = quiz.data.questions.find((q) => q.question === page.question)
          if (!serverQuestion) continue
          const letter = answers[page.id]
          const text = page.options.find((o) => o.letter === letter)?.text
          if (text) payload[serverQuestion.id] = [text]
        }
        const graded = await apiSend<ContractQuizAttempt>("POST", `/quiz-attempts/${attempt.id}/submit`, {
          answers: payload,
        })
        const maxScore = graded.maxScore ?? 0
        const outcome: PostTestResult = {
          scorePct: maxScore > 0 ? Math.round(((graded.score ?? 0) / maxScore) * 100) : 0,
          passed: graded.passed === true,
          correctCount: maxScore > 0 ? Math.round(((graded.score ?? 0) / maxScore) * totalCount) : 0,
        }
        setResult(outcome)
        onComplete?.(outcome.scorePct, outcome.passed)
      } else {
        // Deck without a linked quiz — local evaluation only.
        const outcome = localResult()
        setResult(outcome)
        onComplete?.(outcome.scorePct, outcome.passed)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengirim evaluasi — coba lagi")
    } finally {
      setSubmitting(false)
    }
  }

  function handleRetakeTest() {
    setAnswers({})
    setCurrentIndex(0)
    setResult(null)
    onRetake?.()
  }

  if (result) {
    const { scorePct, passed, correctCount } = result

    return (
      <div
        className={`mx-auto max-w-2xl animate-in space-y-6 rounded-2xl border bg-card p-6 text-center fade-in md:p-8 ${className}`}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Award className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <Badge
            variant="outline"
            className={`px-3 py-1 font-mono text-xs uppercase ${
              passed
                ? "border-emerald-300 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                : "border-amber-300 bg-amber-500/10 text-amber-800 dark:text-amber-300"
            }`}
          >
            {passed ? "Lulus Evaluasi" : "Perlu Remediasi"}
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Hasil Evaluasi Post-Test</h2>
          <p className="text-sm text-muted-foreground">
            Anda memperoleh nilai <strong className="text-foreground">{scorePct}%</strong> ({correctCount} dari{" "}
            {totalCount} soal dijawab dengan benar). Batas kelulusan minimum adalah {Math.round(passingScore * 100)}%.
          </p>
        </div>

        {/* Detailed Review Breakdown */}
        <div className="space-y-3 rounded-xl border bg-muted/20 p-4 text-left">
          <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Pembahasan Soal Evaluasi:
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
                      Jawaban Anda: <strong>{userAns || "Belum dijawab"}</strong> • Kunci Jawaban:{" "}
                      <strong>{q.correct}</strong>
                    </p>
                    {!isCorrect && <p className="mt-1 text-[11px] italic">{q.explanation}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Review Note #9: Satisfaction Prompt & Retake Option */}
        <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-left">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold text-foreground">Apakah Anda sudah puas dengan nilai Anda?</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Anda dapat mengulang evaluasi post-test tanpa batas untuk memperdalam pemahaman diagnostik retinopati dan
            memperbaiki catatan akreditasi klinis Anda.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {/* Unrestricted Retake Button (Review Note #9) — each retake is a
              fresh server attempt (maxAttempts = 0). */}
          <Button variant="outline" onClick={handleRetakeTest} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Ulangi Evaluasi (Retake)
          </Button>

          {/* Certificate Claim if Passed — server-graded pass only */}
          {passed && onClaimCertificate && (
            <Button onClick={onClaimCertificate} className="gap-2 font-semibold shadow-sm">
              <ShieldCheck className="h-4 w-4" />
              Klaim Sertifikat Resmi
            </Button>
          )}
        </div>
      </div>
    )
  }

  const selectedLetter = answers[currentQ.id]
  const isCurrentAnswered = !!selectedLetter

  return (
    <div className={`mx-auto max-w-2xl space-y-6 rounded-2xl border bg-card p-6 shadow-xs md:p-8 ${className}`}>
      {/* Header and Progress */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <span className="font-mono text-xs font-bold text-primary">EVALUASI KLINIS TERSTANDAR</span>
          <h3 className="mt-0.5 text-lg font-bold text-foreground">
            Soal {currentIndex + 1} dari {totalCount}
          </h3>
        </div>

        <Badge variant="outline" className="font-mono text-xs">
          {Math.round(((currentIndex + 1) / totalCount) * 100)}% Selesai
        </Badge>
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
          <span>
            {submitting ? "Menilai..." : currentIndex === totalCount - 1 ? "Selesaikan Evaluasi" : "Soal Berikutnya"}
          </span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
