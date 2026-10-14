import { useCallback, useEffect, useMemo, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardFooter } from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Progress } from "@workspace/ui/components/progress"
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
              <div>
                <p className="text-muted-foreground">Nilai kelulusan</p>
                <p className="font-medium">{quiz.passingScore}</p>
              </div>
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
              {startAttempt.isPending ? "Memulai..." : "Mulai Kuis"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Result state
  if (result) {
    const hasScore = result.score !== null && result.score !== undefined
    const hasMax = result.maxScore !== null && result.maxScore !== undefined
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
          ) : (
            <p className="mt-4 text-muted-foreground">Menunggu penilaian instruktur.</p>
          )}
        </div>

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
          Kembali ke Info Kuis
        </Button>
      </div>
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
