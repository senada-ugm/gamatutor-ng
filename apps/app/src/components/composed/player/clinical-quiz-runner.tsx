import { useState } from "react"
import { Award, CheckCircle2, RotateCcw, XCircle, ArrowRight, HelpCircle, ShieldCheck } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import type { QuizPage } from "@/lib/content/course-types"

interface ClinicalQuizRunnerProps {
  questions: QuizPage[]
  passingScore?: number // e.g. 0.6 or 0.7 (70%)
  onComplete?: (scorePct: number, passed: boolean) => void
  onRetake?: () => void
  onClaimCertificate?: () => void
  className?: string
}

export function ClinicalQuizRunner({
  questions,
  passingScore = 0.7,
  onComplete,
  onRetake,
  onClaimCertificate,
  className = "",
}: ClinicalQuizRunnerProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [isFinished, setIsFinished] = useState<boolean>(false)

  const currentQ = questions[currentIndex]
  const totalCount = questions.length

  function handleSelect(letter: string) {
    if (isFinished) return
    setAnswers((prev) => ({ ...prev, [currentQ.id]: letter }))
  }

  function handleNext() {
    if (currentIndex < totalCount - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      // Calculate score and finish
      finishQuiz()
    }
  }

  function handlePrev() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  function finishQuiz() {
    setIsFinished(true)
    let correctCount = 0
    for (const q of questions) {
      if (answers[q.id] === q.correct) {
        correctCount++
      }
    }
    const pct = Math.round((correctCount / totalCount) * 100)
    const passed = correctCount / totalCount >= passingScore
    onComplete?.(pct, passed)
  }

  function handleRetakeTest() {
    setAnswers({})
    setCurrentIndex(0)
    setIsFinished(false)
    onRetake?.()
  }

  if (isFinished) {
    let correctCount = 0
    for (const q of questions) {
      if (answers[q.id] === q.correct) {
        correctCount++
      }
    }
    const scorePct = Math.round((correctCount / totalCount) * 100)
    const passed = correctCount / totalCount >= passingScore

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
                ? "border-emerald-300 bg-emerald-500/10 text-emerald-800"
                : "border-amber-300 bg-amber-500/10 text-amber-800"
            }`}
          >
            {passed ? "Evaluation Passed" : "Needs Improvement"}
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Post-Test Evaluation Results
          </h2>
          <p className="text-sm text-muted-foreground">
            You scored <strong className="text-foreground">{scorePct}%</strong> ({correctCount} of {totalCount}{" "}
            questions correct). Passing threshold is {Math.round(passingScore * 100)}%.
          </p>
        </div>

        {/* Detailed Review Breakdown */}
        <div className="space-y-3 rounded-xl border bg-muted/20 p-4 text-left">
          <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Question Review Breakdown:
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
                      Your answer: <strong>{userAns || "Unanswered"}</strong> • Correct: <strong>{q.correct}</strong>
                    </p>
                    {!isCorrect && <p className="mt-1 text-[11px] italic">{q.explanation}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Review #9: Explicit Confirmation Prompt & Unrestricted Retake Option */}
        <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-left">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold text-foreground">Are you satisfied with your test score?</span>
          </div>
          <p className="text-xs text-muted-foreground">
            You may retake the post-test without any restrictions to reinforce your diagnostic knowledge and improve
            your certified accreditation record.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {/* Unrestricted Retake Button (Review #9) */}
          <Button variant="outline" onClick={handleRetakeTest} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Retake Evaluation Module
          </Button>

          {/* Certificate Claim if Passed */}
          {passed && onClaimCertificate && (
            <Button onClick={onClaimCertificate} className="gap-2 font-semibold shadow-sm">
              <ShieldCheck className="h-4 w-4" />
              Claim Official Certificate
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
          <span className="font-mono text-xs font-bold text-primary">STANDARDIZED CLINICAL QUIZ</span>
          <h3 className="mt-0.5 text-lg font-bold text-foreground">
            Question {currentIndex + 1} of {totalCount}
          </h3>
        </div>

        <Badge variant="outline" className="font-mono text-xs">
          {Math.round(((currentIndex + 1) / totalCount) * 100)}% Complete
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
          Previous
        </Button>

        <Button size="sm" disabled={!isCurrentAnswered} onClick={handleNext} className="gap-1.5 font-semibold">
          <span>{currentIndex === totalCount - 1 ? "Finish Evaluation" : "Next Question"}</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
