import { useCallback, useEffect, useMemo, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Progress } from "@workspace/ui/components/progress"
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@workspace/ui/composed/questionnaire"
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group"
import { Separator } from "@workspace/ui/components/separator"
import { Textarea } from "@workspace/ui/components/textarea"
import type { ContractQuizDetail, ContractQuizAttempt } from "@workspace/contracts/domain"

import { useConfirm } from "@/components/composed/_shared/confirm-dialog"
import { QuizTimer } from "@/components/composed/player/_atoms/quiz-timer"
import { apiSend } from "@/lib/api"

type Answers = Record<string, string[]>

export function QuizTake({ quiz }: { quiz: ContractQuizDetail }) {
  const confirm = useConfirm()
  const [attempt, setAttempt] = useState<ContractQuizAttempt | null>(null)
  const [answers, setAnswers] = useState<Answers>({})
  const [result, setResult] = useState<ContractQuizAttempt | null>(null)
  const [tabSwitchesCount, setTabSwitchesCount] = useState(0)

  useEffect(() => {
    if (!attempt || result) return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchesCount((prev) => {
          const next = prev + 1
          toast.warning(
            `Peringatan Integritas: Terdeteksi perpindahan tab/jendela (${next}x). Tetap fokus pada lembar pengerjaan!`,
            { duration: 4000 }
          )
          return next
        })
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [attempt, result])

  const startAttempt = useMutation({
    mutationFn: () => apiSend<ContractQuizAttempt>("POST", `/quizzes/${quiz.id}/attempts`),
    onSuccess: (data) => {
      setAttempt(data ?? null)
      setAnswers({})
      setResult(null)
      setTabSwitchesCount(0)
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal memulai kuis"),
  })

  const submitAttempt = useMutation({
    mutationFn: () => {
      if (!attempt) return Promise.resolve(null)
      return apiSend<ContractQuizAttempt>("POST", `/quiz-attempts/${attempt.id}/submit`, { answers })
    },
    onSuccess: (data) => {
      if (data) {
        setResult(data)
        setAttempt(null)
      }
    },
    onError: (error) => {
      const message = (error as { error?: { message?: string } })?.error?.message ?? "Gagal mengirim jawaban"
      toast.error(message)
    },
  })

  const answeredCount = useMemo(() => {
    return quiz.questions.filter((q) => (answers[q.id] ?? []).length > 0).length
  }, [answers, quiz.questions])

  const setAnswer = useCallback(
    (questionId: string, next: string[]) => setAnswers((prev) => ({ ...prev, [questionId]: next })),
    []
  )

  const handleTimerExpire = useCallback(() => {
    if (submitAttempt.isPending) return
    toast.warning("Batas waktu telah habis! Jawaban Anda otomatis dikumpulkan.")
    submitAttempt.mutate()
  }, [submitAttempt])

  const handleManualSubmit = useCallback(async () => {
    if (answeredCount < quiz.questions.length) {
      const unAnswered = quiz.questions.length - answeredCount
      const ok = await confirm({
        title: "Kumpulkan Kuis?",
        description: `Masih ada ${unAnswered} soal yang belum dijawab. Apakah Anda yakin ingin mengumpulkan kuis sekarang?`,
        confirmLabel: "Ya, Kumpulkan",
        cancelLabel: "Lanjutkan Mengerjakan",
      })
      if (!ok) return
    }
    submitAttempt.mutate()
  }, [answeredCount, quiz.questions.length, confirm, submitAttempt])

  // courseId presence is the API's only discriminator between a course
  // quiz and a standalone assessment — there is deliberately no "kind".
  const isAssessment = quiz.courseId == null

  // Idle: quiz info + start button
  if (!attempt && !result) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{quiz.title}</h1>
          {quiz.description ? <p className="mt-1 text-sm text-muted-foreground">{quiz.description}</p> : null}
        </div>
        <Card>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">Jumlah soal</p>
                <p className="font-medium">{quiz.questionCount}</p>
              </div>
              {isAssessment ? null : (
                <div>
                  <p className="text-muted-foreground">Nilai kelulusan</p>
                  <p className="font-medium">{quiz.passingScore}</p>
                </div>
              )}
              {quiz.timeLimit ? (
                <div>
                  <p className="text-muted-foreground">Batas waktu</p>
                  <p className="font-medium">{quiz.timeLimit} menit</p>
                </div>
              ) : null}
              <div>
                <p className="text-muted-foreground">Percobaan</p>
                <p className="font-medium">{quiz.maxAttempts === 0 ? "Tak terbatas" : `Maks ${quiz.maxAttempts}x`}</p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={() => startAttempt.mutate()} disabled={startAttempt.isPending}>
              {startAttempt.isPending ? "Memulai..." : isAssessment ? "Mulai Asesmen" : "Mulai Kuis"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Result state
  if (result) {
    // An assessment has no right answers: every Likert option carries a
    // weight, so `score`/`maxScore` come back 0 and `passed` compares 0
    // against the passing score vacuously. Showing "0/0 Lulus" over a
    // RIASEC profile is a confident wrong answer — the category report
    // below IS the result.
    const hasScore = !isAssessment && result.score !== null && result.score !== undefined
    const hasMax = !isAssessment && result.maxScore !== null && result.maxScore !== undefined
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">{quiz.title}</h1>
          {hasScore && hasMax ? (
            <>
              <p className="mt-4 text-4xl font-bold">
                {result.score}
                <span className="text-xl text-muted-foreground">/{result.maxScore}</span>
              </p>
              {result.passed !== null && result.passed !== undefined ? (
                <Badge variant={result.passed ? "default" : "destructive"} className="mt-2">
                  {result.passed ? "Lulus" : "Belum Lulus"}
                </Badge>
              ) : (
                <Badge variant="secondary" className="mt-2">
                  Menunggu penilaian
                </Badge>
              )}
            </>
          ) : isAssessment ? null : (
            <p className="mt-4 text-muted-foreground">Menunggu penilaian instruktur.</p>
          )}
        </div>

        <AssessmentReport categoryScores={result.categoryScores} reportMeta={result.reportMeta} />

        {quiz.showResults ? (
          <div className="space-y-4">
            <h2 className="font-semibold">Rincian Jawaban</h2>
            {quiz.questions.map((q, i) => {
              const given = (result.answers as Answers)?.[q.id] ?? []
              const wasCorrect =
                q.correctAnswers &&
                q.correctAnswers.length === given.length &&
                q.correctAnswers.every((a) => given.includes(a))
              return (
                <Card key={q.id}>
                  <CardContent className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">
                        {i + 1}. {q.question}
                      </p>
                      {q.correctAnswers ? (
                        <Badge variant={wasCorrect ? "default" : "destructive"} className="shrink-0">
                          {wasCorrect ? "Benar" : "Salah"}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">Jawaban Anda: {given.join(", ") || "—"}</p>
                    {!wasCorrect && q.correctAnswers ? (
                      <p className="text-xs text-muted-foreground">Jawaban benar: {q.correctAnswers.join(", ")}</p>
                    ) : null}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : null}

        <Button variant="outline" className="w-full" onClick={() => setResult(null)}>
          {isAssessment ? "Kembali ke Info Asesmen" : "Kembali ke Info Kuis"}
        </Button>
      </div>
    )
  }

  // An assessment is a long run of interchangeable items answered in one
  // sitting, which is what the questionnaire primitive is built for: one
  // item at a time, keyboard shortcuts, its own progress. A graded quiz
  // is not — a learner scans it, skips ahead, and reviews before
  // submitting, and a wizard hides all of that behind Next.
  if (isAssessment) {
    return (
      <AssessmentRun
        quiz={quiz}
        answers={answers}
        onAnswer={setAnswer}
        submitting={submitAttempt.isPending}
        onSubmit={() => submitAttempt.mutate()}
        startedAt={attempt?.startedAt}
        onExpire={handleTimerExpire}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-20 -mx-4 -mt-2 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{quiz.title}</h1>
              <span className="text-xs text-muted-foreground md:text-sm">
                {answeredCount}/{quiz.questions.length} terjawab
              </span>
            </div>
            {tabSwitchesCount > 0 ? (
              <Badge variant="destructive" className="text-xs">
                {tabSwitchesCount}x Peringatan Tab
              </Badge>
            ) : null}
          </div>
          {quiz.timeLimit && attempt ? (
            <QuizTimer startedAt={attempt.startedAt} timeLimitMinutes={quiz.timeLimit} onExpire={handleTimerExpire} />
          ) : null}
        </div>
        <Progress value={(answeredCount / quiz.questions.length) * 100} className="mt-2 h-1.5" />
      </div>

      <div className="space-y-4">
        {quiz.questions.map((q, i) => (
          <QuestionInput
            key={q.id}
            index={i}
            question={q.question}
            questionType={q.questionType}
            options={q.options}
            answers={answers[q.id] ?? []}
            onChange={(next) => setAnswer(q.id, next)}
          />
        ))}
      </div>

      <Separator />

      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={() => void handleManualSubmit()}
          disabled={submitAttempt.isPending || answeredCount === 0}
        >
          {submitAttempt.isPending ? "Mengirim..." : "Kirim Jawaban"}
        </Button>
      </div>
    </div>
  )
}

/**
 * The assessment run: `Questionnaire` owns which item is showing, the
 * progress counter, the letter shortcuts and the Previous/Next/Submit
 * navigation. Answers stay in QuizTake's own `Answers` map rather than
 * in form state, because that map is what the submit endpoint takes and
 * what the result breakdown reads back.
 */
function AssessmentRun({
  quiz,
  answers,
  onAnswer,
  submitting,
  onSubmit,
  startedAt,
  onExpire,
}: {
  quiz: ContractQuizDetail
  answers: Answers
  onAnswer: (questionId: string, next: string[]) => void
  submitting: boolean
  onSubmit: () => void
  startedAt?: string
  onExpire?: () => void
}) {
  const [current, setCurrent] = useState(quiz.questions[0]?.id ?? "")
  // QuestionnaireProgress renders its own English "Question 1 of 3" and
  // takes no localised children, and `current` is already this
  // component's state — so the counter and the bar are rendered here,
  // with the shared Progress primitive the rest of the app uses.
  const index = Math.max(
    quiz.questions.findIndex((q) => q.id === current),
    0
  )
  const items = useMemo(
    () =>
      quiz.questions.map((q) => ({
        name: q.id,
        choices: q.options.map((opt) => ({ value: opt.text })),
      })),
    [quiz.questions]
  )

  return (
    <Questionnaire
      items={items}
      item={current}
      onItemChange={setCurrent}
      shortcuts="letters"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <div className="sticky top-0 z-20 -mx-4 -mt-2 mb-6 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{quiz.title}</h1>
          <div className="flex items-center gap-3">
            {quiz.timeLimit && startedAt && onExpire ? (
              <QuizTimer startedAt={startedAt} timeLimitMinutes={quiz.timeLimit} onExpire={onExpire} />
            ) : null}
            <span className="shrink-0 text-xs font-medium text-muted-foreground md:text-sm">
              {index + 1}/{quiz.questions.length}
            </span>
          </div>
        </div>
        <Progress value={((index + 1) / quiz.questions.length) * 100} className="mt-2 h-1.5" />
      </div>

      {quiz.questions.map((q, i) => {
        const given = answers[q.id] ?? []
        const isMulti = q.questionType === "multiple_choice"
        const isFreeText = q.questionType === "essay" || q.questionType === "short_answer"
        return (
          <QuestionnaireItem key={q.id} name={q.id} multiple={isMulti}>
            <QuestionnaireTitle>
              {i + 1}. {q.question}
            </QuestionnaireTitle>
            {isMulti ? <QuestionnaireDescription>Pilih semua yang sesuai.</QuestionnaireDescription> : null}
            {isFreeText ? (
              // QuestionnaireInput is single-line only, and an essay in a
              // one-line field is a worse answer box than the one the
              // quiz list already has.
              <Textarea
                rows={q.questionType === "essay" ? 5 : 2}
                value={given[0] ?? ""}
                onChange={(e) => onAnswer(q.id, e.target.value ? [e.target.value] : [])}
                placeholder="Tulis jawaban Anda..."
              />
            ) : (
              <QuestionnaireChoices>
                {q.options.map((opt) => (
                  <QuestionnaireChoice
                    key={opt.text}
                    value={opt.text}
                    checked={given.includes(opt.text)}
                    onChange={() =>
                      onAnswer(
                        q.id,
                        isMulti
                          ? given.includes(opt.text)
                            ? given.filter((a) => a !== opt.text)
                            : [...given, opt.text]
                          : [opt.text]
                      )
                    }
                  >
                    {opt.text}
                  </QuestionnaireChoice>
                ))}
              </QuestionnaireChoices>
            )}
          </QuestionnaireItem>
        )
      })}

      <QuestionnaireActions>
        <QuestionnairePrevious>Sebelumnya</QuestionnairePrevious>
        <QuestionnaireNext>Berikutnya</QuestionnaireNext>
        <QuestionnaireSubmit disabled={submitting}>{submitting ? "Mengirim..." : "Kirim Jawaban"}</QuestionnaireSubmit>
      </QuestionnaireActions>
    </Questionnaire>
  )
}

function QuestionInput({
  index,
  question,
  questionType,
  options,
  answers,
  onChange,
}: {
  index: number
  question: string
  questionType: string
  options: Array<{ text: string }>
  answers: string[]
  onChange: (next: string[]) => void
}) {
  const [essayText, setEssayText] = useState(answers[0] ?? "")

  if (questionType === "essay" || questionType === "short_answer") {
    return (
      <Card>
        <CardContent className="space-y-3">
          <Label>
            {index + 1}. {question}
          </Label>
          {questionType === "essay" ? (
            <Textarea
              rows={4}
              value={essayText}
              onChange={(e) => {
                setEssayText(e.target.value)
                onChange(e.target.value ? [e.target.value] : [])
              }}
              placeholder="Tulis jawaban Anda..."
            />
          ) : (
            <Input
              value={essayText}
              onChange={(e) => {
                setEssayText(e.target.value)
                onChange(e.target.value ? [e.target.value] : [])
              }}
              placeholder="Jawaban singkat..."
            />
          )}
        </CardContent>
      </Card>
    )
  }

  const isMulti = questionType === "multiple_choice"

  const rowClass = (isSelected: boolean) =>
    [
      "flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition-colors",
      isSelected ? "border-primary bg-primary/5" : "hover:bg-muted",
    ].join(" ")

  if (isMulti) {
    return (
      <Card>
        <CardContent className="space-y-3">
          <Label>
            {index + 1}. {question}
          </Label>
          <div className="space-y-2">
            {options.map((opt) => {
              const isSelected = answers.includes(opt.text)
              return (
                <label key={opt.text} className={rowClass(isSelected)}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() =>
                      onChange(isSelected ? answers.filter((a) => a !== opt.text) : [...answers, opt.text])
                    }
                  />
                  {opt.text}
                </label>
              )
            })}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <Label>
          {index + 1}. {question}
        </Label>
        <RadioGroup value={answers[0] ?? null} onValueChange={(value) => value && onChange([value])}>
          {options.map((opt) => {
            const isSelected = answers.includes(opt.text)
            return (
              <label key={opt.text} className={rowClass(isSelected)}>
                <RadioGroupItem value={opt.text} />
                {opt.text}
              </label>
            )
          })}
        </RadioGroup>
      </CardContent>
    </Card>
  )
}

/**
 * An assessment's real output. `quizzes.service.ts` sums each question's
 * `optionWeights` into a per-`category` score and, when every category is
 * a RIASEC letter, derives the Holland top-3 into `reportMeta.topTypes`.
 * None of it was rendered — an interest profile was computed on every
 * submit and then thrown away behind a score out of 100, which is not
 * what a RIASEC result means. Renders nothing for an ordinary quiz,
 * which carries neither field.
 */
function AssessmentReport({
  categoryScores,
  reportMeta,
}: {
  categoryScores?: Record<string, unknown>
  reportMeta?: Record<string, unknown>
}) {
  // The spec types these precisely (`Record<int32>` emits
  // `unevaluatedProperties: {type: integer}` in the OpenAPI), but hey-api
  // doesn't read that JSON-Schema keyword and generates `unknown`. The
  // spec is right and generated output is never hand-edited, so the
  // narrowing happens here, at the boundary.
  const scores = Object.entries(categoryScores ?? {})
    .map(([category, value]) => [category, Number(value)] as const)
    .filter(([, value]) => Number.isFinite(value))
  if (scores.length === 0) return null

  const topTypes = Array.isArray(reportMeta?.topTypes)
    ? (reportMeta.topTypes as Array<{ type?: unknown }>).map((t) => String(t.type ?? "")).filter(Boolean)
    : []
  const max = Math.max(...scores.map(([, value]) => value), 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hasil Asesmen</CardTitle>
        <CardDescription>
          {topTypes.length > 0 ? "Kode Holland Anda, diurutkan dari kecenderungan terkuat." : "Skor per kategori."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {topTypes.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {topTypes.map((type) => (
              <Badge key={type} className="text-sm">
                {RIASEC_LABELS[type] ? `${type} — ${RIASEC_LABELS[type]}` : type}
              </Badge>
            ))}
          </div>
        ) : null}
        <div className="space-y-2">
          {scores
            .sort((a, b) => b[1] - a[1])
            .map(([category, value]) => (
              <div key={category} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span>{RIASEC_LABELS[category] ? `${category} — ${RIASEC_LABELS[category]}` : category}</span>
                  <span className="text-muted-foreground tabular-nums">{value}</span>
                </div>
                <Progress value={Math.round((value / max) * 100)} aria-label={`Skor ${category}`} />
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  )
}

/** Holland codes carry standard names; anything else (grammar,
 *  vocabulary, a psychometric scale) renders as authored. */
const RIASEC_LABELS: Record<string, string> = {
  R: "Realistic",
  I: "Investigative",
  A: "Artistic",
  S: "Social",
  E: "Enterprising",
  C: "Conventional",
}
