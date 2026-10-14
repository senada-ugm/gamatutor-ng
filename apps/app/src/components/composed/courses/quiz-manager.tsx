import { Fragment, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Check } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Textarea } from "@workspace/ui/components/textarea"

import { apiGet, apiSend } from "@/lib/api"
import { formatCourseDate } from "@/lib/lms-date"
import { BackLink } from "@/components/composed/_shared/back-link"
import { EmptyState } from "@/components/composed/_shared/empty-state"
import { useConfirm } from "@/components/composed/_shared/confirm-dialog"
import type {
  ContractQuiz,
  ContractQuizAttempt,
  ContractQuizDetail,
  ContractQuizQuestion,
  ContractQuizQuestionType,
} from "@workspace/contracts/domain"

/**
 * Kuis tab: quiz list + creation, and the question builder. Grading of
 * pending-review essay attempts is NOT here — the API has no
 * manager-facing "all attempts" list to build it on (only the caller's
 * own attempts), a backend gap flagged in AGENTS.md.
 */

interface QuizSummary {
  id: string
  title: string
  questionCount: number
  timeLimit?: number | null
  maxAttempts: number
}

/**
 * A quiz belongs to a course; an assessment is the same thing without
 * one — `quizzes` rows carry a nullable `courseId` and the API branches
 * on it (`assertCanManageQuiz`: course managers when it is set, admins
 * when it is null). Only the list and create routes differ; everything
 * downstream — `/quizzes/{id}`, its questions, its attempts — is already
 * course-less and serves both.
 */
const SCOPE_COPY = {
  heading: "Kuis",
  create: "Kuis Baru",
  submit: "Buat Kuis",
  created: "Kuis dibuat",
  emptyTitle: "Belum ada kuis",
  emptyBody: "Buat kuis pertama untuk pelatihan ini.",
  deleteTitle: "Hapus kuis?",
} as const

export function QuizManager({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const copy = SCOPE_COPY
  const collectionPath = `/courses/${courseId}/quizzes`
  const queryKey = ["quizzes", courseId]

  const quizzes = useQuery({
    queryKey,
    queryFn: () => apiGet<QuizSummary[]>(`${collectionPath}?pageSize=100`),
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey })
  }

  const createQuiz = useMutation({
    mutationFn: (values: QuizFormValues) => apiSend<ContractQuiz>("POST", collectionPath, toQuizPayload(values)),
    onSuccess: (quiz) => {
      toast.success(copy.created)
      setShowCreate(false)
      invalidate()
      setSelectedId(quiz.id)
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal membuat kuis"),
  })

  const deleteQuiz = useMutation({
    mutationFn: (quizId: string) => apiSend<null>("DELETE", `/quizzes/${quizId}`),
    onSuccess: () => {
      toast.success("Kuis dihapus")
      setSelectedId(null)
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menghapus kuis"),
  })

  if (selectedId) {
    return <QuizBuilder quizId={selectedId} onBack={() => setSelectedId(null)} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">{copy.heading}</h2>
        <Button onClick={() => setShowCreate((v) => !v)}>{copy.create}</Button>
      </div>

      {showCreate ? (
        <QuizForm
          submitLabel={copy.submit}
          submitting={createQuiz.isPending}
          onSubmit={(values) => createQuiz.mutate(values)}
          onCancel={() => setShowCreate(false)}
        />
      ) : null}

      {quizzes.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (quizzes.data ?? []).length === 0 ? (
        <EmptyState title={copy.emptyTitle} description={copy.emptyBody} />
      ) : (
        <ItemGroup>
          {(quizzes.data ?? []).map((quiz, index) => (
            <Fragment key={quiz.id}>
              {index > 0 ? <ItemSeparator /> : null}
              <Item>
                <ItemContent>
                  <ItemTitle>{quiz.title}</ItemTitle>
                  <ItemDescription className="line-clamp-1 text-xs">
                    {quiz.questionCount} soal
                    {quiz.timeLimit ? ` · ${quiz.timeLimit} menit` : ""} ·{" "}
                    {quiz.maxAttempts === 0 ? "Tak terbatas" : `Maks ${quiz.maxAttempts}x`} percobaan
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button size="sm" variant="outline" onClick={() => setSelectedId(quiz.id)}>
                    Kelola Soal
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      void confirm({
                        title: copy.deleteTitle,
                        description: `"${quiz.title}" beserta seluruh soal dan percobaan peserta akan dihapus permanen.`,
                        confirmLabel: "Hapus",
                        destructive: true,
                      }).then((ok) => {
                        if (ok) deleteQuiz.mutate(quiz.id)
                      })
                    }}
                  >
                    Hapus
                  </Button>
                </ItemActions>
              </Item>
            </Fragment>
          ))}
        </ItemGroup>
      )}
    </div>
  )
}

// --- Quiz create/edit form -------------------------------------------------

interface QuizFormValues {
  title: string
  description: string
  passingScore: string
  timeLimit: string
  maxAttempts: string
  shuffleQuestions: boolean
  shuffleOptions: boolean
  showResults: boolean
  showCorrectAnswers: boolean
}

function quizFormValuesFromQuiz(quiz: ContractQuizDetail): QuizFormValues {
  return {
    title: quiz.title,
    description: quiz.description ?? "",
    passingScore: String(quiz.passingScore ?? 0),
    timeLimit: quiz.timeLimit ? String(quiz.timeLimit) : "",
    maxAttempts: String(quiz.maxAttempts ?? 0),
    shuffleQuestions: quiz.shuffleQuestions ?? false,
    shuffleOptions: quiz.shuffleOptions ?? false,
    showResults: quiz.showResults ?? false,
    showCorrectAnswers: quiz.showCorrectAnswers ?? false,
  }
}

function toQuizPayload(values: QuizFormValues) {
  return {
    title: values.title,
    description: values.description || undefined,
    passingScore: values.passingScore ? Number(values.passingScore) : undefined,
    timeLimit: values.timeLimit ? Number(values.timeLimit) : undefined,
    maxAttempts: values.maxAttempts ? Number(values.maxAttempts) : undefined,
    shuffleQuestions: values.shuffleQuestions,
    shuffleOptions: values.shuffleOptions,
    showResults: values.showResults,
    showCorrectAnswers: values.showCorrectAnswers,
  }
}

function QuizForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial?: QuizFormValues
  submitLabel: string
  submitting: boolean
  onSubmit: (values: QuizFormValues) => void
  onCancel?: () => void
}) {
  const [values, setValues] = useState<QuizFormValues>(
    initial ?? {
      title: "",
      description: "",
      passingScore: "70",
      timeLimit: "",
      maxAttempts: "0",
      shuffleQuestions: false,
      shuffleOptions: false,
      showResults: true,
      showCorrectAnswers: true,
    }
  )

  function update<TKey extends keyof QuizFormValues>(key: TKey, value: QuizFormValues[TKey]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.title.trim()) {
      toast.error("Judul kuis wajib diisi")
      return
    }
    onSubmit(values)
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="quiz-title">Judul</Label>
            <Input id="quiz-title" value={values.title} onChange={(e) => update("title", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quiz-description">Deskripsi (opsional)</Label>
            <Textarea
              id="quiz-description"
              rows={2}
              value={values.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="quiz-passing">Nilai Kelulusan</Label>
              <Input
                id="quiz-passing"
                type="number"
                min={0}
                max={100}
                value={values.passingScore}
                onChange={(e) => update("passingScore", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quiz-timelimit">Batas Waktu (menit)</Label>
              <Input
                id="quiz-timelimit"
                type="number"
                min={0}
                value={values.timeLimit}
                onChange={(e) => update("timeLimit", e.target.value)}
                placeholder="Tanpa batas"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quiz-maxattempts">Maks. Percobaan (0 = bebas)</Label>
              <Input
                id="quiz-maxattempts"
                type="number"
                min={0}
                value={values.maxAttempts}
                onChange={(e) => update("maxAttempts", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.shuffleQuestions}
                onCheckedChange={(c) => update("shuffleQuestions", c === true)}
              />
              Acak urutan soal
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={values.shuffleOptions} onCheckedChange={(c) => update("shuffleOptions", c === true)} />
              Acak urutan opsi
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={values.showResults} onCheckedChange={(c) => update("showResults", c === true)} />
              Tampilkan hasil ke peserta
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.showCorrectAnswers}
                onCheckedChange={(c) => update("showCorrectAnswers", c === true)}
              />
              Tampilkan kunci jawaban
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Menyimpan..." : submitLabel}
            </Button>
            {onCancel ? (
              <Button type="button" variant="outline" onClick={onCancel}>
                Batal
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// --- Quiz builder (settings + questions) ------------------------------------

const QUESTION_TYPES: { value: ContractQuizQuestionType; label: string }[] = [
  { value: "single_choice", label: "Pilihan Ganda" },
  { value: "multiple_choice", label: "Pilihan Ganda (Multi)" },
  { value: "true_false", label: "Benar/Salah" },
  { value: "short_answer", label: "Jawaban Singkat" },
  { value: "essay", label: "Esai" },
]

function QuizBuilder({ quizId, onBack }: { quizId: string; onBack: () => void }) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [showQuestionForm, setShowQuestionForm] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<ContractQuizQuestion | null>(null)

  const quiz = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: () => apiGet<ContractQuizDetail>(`/quizzes/${quizId}`),
  })
  const [showAttempts, setShowAttempts] = useState(false)

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["quiz", quizId] })
  }

  const updateQuiz = useMutation({
    mutationFn: (values: QuizFormValues) => apiSend<ContractQuiz>("PATCH", `/quizzes/${quizId}`, toQuizPayload(values)),
    onSuccess: (updated) =>
      toast.success(updated.courseId == null ? "Pengaturan asesmen disimpan" : "Pengaturan kuis disimpan"),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menyimpan"),
  })

  const addQuestion = useMutation({
    mutationFn: (payload: QuestionPayload) =>
      apiSend<ContractQuizQuestion>("POST", `/quizzes/${quizId}/questions`, payload),
    onSuccess: () => {
      toast.success("Pertanyaan ditambahkan")
      setShowQuestionForm(false)
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menambah pertanyaan"),
  })

  const updateQuestion = useMutation({
    mutationFn: (input: { id: string; payload: QuestionPayload }) =>
      apiSend<ContractQuizQuestion>("PATCH", `/quiz-questions/${input.id}`, input.payload),
    onSuccess: () => {
      toast.success("Pertanyaan disimpan")
      setEditingQuestion(null)
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menyimpan pertanyaan"),
  })

  const deleteQuestion = useMutation({
    mutationFn: (questionId: string) => apiSend<null>("DELETE", `/quiz-questions/${questionId}`),
    onSuccess: () => {
      toast.success("Pertanyaan dihapus")
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menghapus pertanyaan"),
  })

  if (quiz.isLoading) {
    return <Skeleton className="h-48 w-full" />
  }
  if (!quiz.data) {
    return <EmptyState title="Tidak ditemukan" description="Kuis atau asesmen ini mungkin sudah dihapus." />
  }

  const q = quiz.data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <BackLink onClick={onBack} label="Kembali ke Kuis" />
          <h2 className="text-lg font-medium">{q.title}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAttempts((v) => !v)}>
            Periksa Percobaan
          </Button>
          <Button onClick={() => setShowQuestionForm((v) => !v)}>Tambah Pertanyaan</Button>
        </div>
      </div>

      {showAttempts ? <AttemptsQueue quizId={quizId} questions={q.questions} /> : null}

      <div>
        <h3 className="mb-2 text-sm font-semibold">Pengaturan</h3>
        <QuizForm
          initial={quizFormValuesFromQuiz(q)}
          submitLabel="Simpan Pengaturan"
          submitting={updateQuiz.isPending}
          onSubmit={(values) => updateQuiz.mutate(values)}
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Pertanyaan ({q.questions.length})</h3>

        {showQuestionForm ? (
          <QuestionForm
            submitting={addQuestion.isPending}
            onSubmit={(payload) => addQuestion.mutate(payload)}
            onCancel={() => setShowQuestionForm(false)}
          />
        ) : null}
        {editingQuestion ? (
          <QuestionForm
            initial={questionPayloadFromQuestion(editingQuestion)}
            submitting={updateQuestion.isPending}
            onSubmit={(payload) => updateQuestion.mutate({ id: editingQuestion.id, payload })}
            onCancel={() => setEditingQuestion(null)}
          />
        ) : null}

        {q.questions.length === 0 ? (
          <EmptyState compact title="Belum ada pertanyaan" description="Tambahkan pertanyaan pertama untuk kuis ini." />
        ) : (
          q.questions.map((question, i) => (
            <Card key={question.id}>
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">
                    {i + 1}. {question.question}
                  </p>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditingQuestion(question)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        void confirm({
                          title: "Hapus pertanyaan?",
                          description: "Pertanyaan ini akan dihapus permanen dari kuis.",
                          confirmLabel: "Hapus",
                          destructive: true,
                        }).then((ok) => {
                          if (ok) deleteQuestion.mutate(question.id)
                        })
                      }}
                    >
                      Hapus
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">
                    {QUESTION_TYPES.find((t) => t.value === question.questionType)?.label ?? question.questionType}
                  </Badge>
                  <span>{question.points} poin</span>
                </div>
                {question.options.length > 0 ? (
                  <ul className="space-y-0.5 text-sm">
                    {question.options.map((opt) => (
                      <li
                        key={opt.text}
                        className={[
                          "flex items-center gap-1",
                          question.correctAnswers?.includes(opt.text) ? "font-medium" : "text-muted-foreground",
                        ].join(" ")}
                      >
                        {opt.text}
                        {question.correctAnswers?.includes(opt.text) ? (
                          <Check className="size-3.5" aria-label="Jawaban benar" />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

interface QuestionPayload {
  question: string
  questionType: ContractQuizQuestionType
  options: Array<{ text: string }>
  correctAnswers?: string[]
  points: number
}

function questionPayloadFromQuestion(question: ContractQuizQuestion): QuestionPayload {
  return {
    question: question.question,
    questionType: question.questionType,
    options: question.options.map((o) => ({ text: o.text })),
    correctAnswers: question.correctAnswers ?? [],
    points: question.points ?? 1,
  }
}

function QuestionForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial?: QuestionPayload
  submitting: boolean
  onSubmit: (payload: QuestionPayload) => void
  onCancel: () => void
}) {
  const [question, setQuestion] = useState(initial?.question ?? "")
  const [questionType, setQuestionType] = useState<ContractQuizQuestionType>(initial?.questionType ?? "single_choice")
  const [options, setOptions] = useState<string[]>(initial?.options.map((o) => o.text) ?? ["", "", "", ""])
  const [correctAnswers, setCorrectAnswers] = useState<string[]>(initial?.correctAnswers ?? [])
  const [points, setPoints] = useState(String(initial?.points ?? 1))

  function handleTypeChange(type: ContractQuizQuestionType) {
    setQuestionType(type)
    setCorrectAnswers([])
    if (type === "true_false") setOptions(["Benar", "Salah"])
    else if (type === "essay" || type === "short_answer") setOptions([])
    else if (options.length === 0) setOptions(["", "", "", ""])
  }

  function handleOptionChange(index: number, value: string) {
    const oldValue = options[index] ?? ""
    setOptions((prev) => prev.map((opt, i) => (i === index ? value : opt)))
    if (correctAnswers.includes(oldValue)) {
      setCorrectAnswers((prev) => prev.map((ans) => (ans === oldValue ? value : ans)))
    }
  }

  function toggleCorrect(option: string) {
    if (questionType === "single_choice" || questionType === "true_false") {
      setCorrectAnswers([option])
    } else if (questionType === "multiple_choice") {
      setCorrectAnswers((prev) => (prev.includes(option) ? prev.filter((a) => a !== option) : [...prev, option]))
    }
  }

  function handleSave() {
    if (!question.trim()) {
      toast.error("Mohon masukkan pertanyaan")
      return
    }
    const needsOptions = questionType !== "essay" && questionType !== "short_answer"
    const pairs = options.map((text) => ({ text: text.trim() })).filter((pair) => pair.text !== "")
    if (needsOptions && pairs.length < 2) {
      toast.error("Mohon tambahkan setidaknya 2 opsi")
      return
    }
    if (needsOptions && correctAnswers.length === 0) {
      toast.error("Mohon pilih setidaknya satu jawaban benar")
      return
    }
    onSubmit({
      question: question.trim(),
      questionType,
      options: needsOptions ? pairs.map((pair) => ({ text: pair.text })) : [],
      correctAnswers: needsOptions ? correctAnswers : undefined,
      points: Number(points) || 1,
    })
  }

  const needsOptions = questionType !== "essay" && questionType !== "short_answer"

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="question-text">Teks Pertanyaan</Label>
          <Textarea id="question-text" rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="question-type">Jenis Pertanyaan</Label>
            <NativeSelect
              id="question-type"
              className="w-full"
              value={questionType}
              onChange={(e) => handleTypeChange(e.target.value as ContractQuizQuestionType)}
            >
              {QUESTION_TYPES.map((t) => (
                <NativeSelectOption key={t.value} value={t.value}>
                  {t.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="question-points">Poin</Label>
            <Input
              id="question-points"
              type="number"
              min={1}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />
          </div>
        </div>

        {needsOptions ? (
          <div className="space-y-2">
            <Label>Opsi Jawaban</Label>
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Checkbox checked={correctAnswers.includes(opt)} onCheckedChange={() => toggleCorrect(opt)} />
                <Input
                  value={opt}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  placeholder={`Opsi ${String.fromCharCode(65 + idx)}`}
                  disabled={questionType === "true_false"}
                />
                {questionType !== "true_false" && options.length > 2 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const removed = options[idx] ?? ""
                      setOptions((prev) => prev.filter((_, i) => i !== idx))
                      setCorrectAnswers((prev) => prev.filter((a) => a !== removed))
                    }}
                  >
                    Hapus
                  </Button>
                ) : null}
              </div>
            ))}
            {questionType !== "true_false" ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setOptions((prev) => [...prev, ""])}>
                + Tambah Opsi
              </Button>
            ) : null}
            <p className="text-xs text-muted-foreground">Centang opsi yang merupakan jawaban benar.</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {questionType === "essay"
              ? "Soal esai dinilai manual oleh instruktur setelah dikumpulkan."
              : "Jawaban singkat dinilai otomatis dengan pencocokan teks."}
          </p>
        )}

        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={submitting}>
            {submitting ? "Menyimpan..." : "Simpan Pertanyaan"}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            Batal
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * The essay grading queue: every participant's attempts at this quiz
 * (scope=all — manager-gated server-side). pending_review attempts
 * expand into the learner's answers with a per-essay-question score
 * input; grading is server-side (POST grade with per-question scores).
 */
const ATTEMPT_BADGES: Record<
  string,
  {
    label: string
    variant: "default" | "secondary" | "outline" | "destructive"
  }
> = {
  in_progress: { label: "Sedang Dikerjakan", variant: "secondary" },
  pending_review: { label: "Menunggu Penilaian", variant: "default" },
  graded: { label: "Dinilai", variant: "outline" },
  expired: { label: "Kedaluwarsa", variant: "destructive" },
}

function AttemptsQueue({ quizId, questions }: { quizId: string; questions: ContractQuizQuestion[] }) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const attempts = useQuery({
    queryKey: ["quiz-attempts-all", quizId],
    queryFn: () => apiGet<ContractQuizAttempt[]>(`/quizzes/${quizId}/attempts?scope=all&pageSize=200`),
  })

  const grade = useMutation({
    mutationFn: (input: { id: string; scores: Record<string, number> }) =>
      apiSend<ContractQuizAttempt>("POST", `/quiz-attempts/${input.id}/grade`, {
        scores: input.scores,
      }),
    onSuccess: () => {
      toast.success("Jawaban dinilai")
      setExpandedId(null)
      void queryClient.invalidateQueries({
        queryKey: ["quiz-attempts-all", quizId],
      })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menilai jawaban"),
  })

  const resetAttempt = useMutation({
    mutationFn: (id: string) => apiSend<null>("DELETE", `/quiz-attempts/${id}`),
    onSuccess: () => {
      toast.success("Percobaan direset — peserta dapat mengulang")
      void queryClient.invalidateQueries({
        queryKey: ["quiz-attempts-all", quizId],
      })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal mereset percobaan"),
  })

  if (attempts.isLoading) {
    return <Skeleton className="h-32 w-full" />
  }

  const rows = [...(attempts.data ?? [])].sort(
    (a, b) =>
      Number(a.status === "pending_review") - Number(b.status === "pending_review") ||
      (b.submittedAt ?? "").localeCompare(a.submittedAt ?? "")
  )

  if (rows.length === 0) {
    return (
      <EmptyState title="Belum ada percobaan" description="Peserta yang mengerjakan kuis ini akan muncul di sini." />
    )
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Percobaan Peserta ({rows.length})</h3>
          <p className="text-xs text-muted-foreground">
            {rows.filter((r) => r.status === "pending_review").length} menunggu penilaian
          </p>
        </div>
        <div className="space-y-3">
          {rows.map((attempt) => {
            const badge = ATTEMPT_BADGES[attempt.status] ?? ATTEMPT_BADGES.in_progress
            const isExpanded = expandedId === attempt.id
            const canGrade = attempt.status === "pending_review"
            return (
              <div key={attempt.id} className="space-y-3 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {attempt.user?.name ?? attempt.userId}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        percobaan #{attempt.attemptNumber}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {attempt.user?.email}
                      {attempt.submittedAt
                        ? ` · dikumpulkan ${formatCourseDate(attempt.submittedAt, { full: false })}`
                        : " · belum dikumpulkan"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {attempt.score != null ? (
                      <Badge variant="outline">
                        {attempt.score}/{attempt.maxScore ?? "?"}
                      </Badge>
                    ) : null}
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    <Button size="sm" variant="outline" onClick={() => setExpandedId(isExpanded ? null : attempt.id)}>
                      {isExpanded ? "Tutup" : canGrade ? "Nilai" : "Lihat"}
                    </Button>
                    {attempt.status !== "pending_review" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={resetAttempt.isPending}
                        onClick={() => {
                          void confirm({
                            title: "Reset percobaan?",
                            description: "Jawaban dan nilai yang tersimpan dihapus, peserta dapat mengerjakan ulang.",
                            confirmLabel: "Reset",
                            destructive: true,
                          }).then((ok) => {
                            if (ok) resetAttempt.mutate(attempt.id)
                          })
                        }}
                      >
                        Reset
                      </Button>
                    ) : null}
                  </div>
                </div>

                {isExpanded ? (
                  <AttemptReviewDetail
                    attemptId={attempt.id}
                    fallback={attempt}
                    questions={questions}
                    canGrade={canGrade}
                    submitting={grade.isPending}
                    onGrade={(scores) => grade.mutate({ id: attempt.id, scores })}
                  />
                ) : null}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function AttemptReviewDetail({
  attemptId,
  fallback,
  questions,
  canGrade,
  submitting,
  onGrade,
}: {
  attemptId: string
  fallback: ContractQuizAttempt
  questions: ContractQuizQuestion[]
  canGrade: boolean
  submitting: boolean
  onGrade: (scores: Record<string, number>) => void
}) {
  const query = useQuery({
    queryKey: ["quiz-attempt", attemptId],
    queryFn: () => apiGet<ContractQuizAttempt>(`/quiz-attempts/${attemptId}`),
    initialData: fallback,
  })
  const attempt = query.data ?? fallback
  return canGrade ? (
    <EssayGradeForm questions={questions} attempt={attempt} submitting={submitting} onSubmit={onGrade} />
  ) : (
    <AttemptAnswers questions={questions} attempt={attempt} />
  )
}

function AttemptAnswers({ questions, attempt }: { questions: ContractQuizQuestion[]; attempt: ContractQuizAttempt }) {
  const answers = (attempt.answers ?? {}) as Record<string, string[]>
  return (
    <div className="space-y-2">
      {questions.map((question, i) => (
        <div key={question.id} className="rounded-md bg-muted/40 p-2 text-sm">
          <p className="font-medium">
            {i + 1}. {question.question}
          </p>
          <p className="mt-0.5 text-muted-foreground">Jawaban: {answers[question.id]?.join(", ") || "—"}</p>
        </div>
      ))}
    </div>
  )
}

function EssayGradeForm({
  questions,
  attempt,
  submitting,
  onSubmit,
}: {
  questions: ContractQuizQuestion[]
  attempt: ContractQuizAttempt
  submitting: boolean
  onSubmit: (scores: Record<string, number>) => void
}) {
  const essays = questions.filter((q) => q.questionType === "essay")
  const [scores, setScores] = useState<Record<string, string>>({})

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: Record<string, number> = {}
    for (const q of essays) {
      const raw = scores[q.id] ?? ""
      const value = Number(raw)
      if (raw === "" || Number.isNaN(value) || value < 0 || value > (q.points ?? 1)) {
        toast.error(`Isi nilai soal ${q.question.slice(0, 30)}… antara 0 dan ${q.points ?? 1}`)
        return
      }
      payload[q.id] = value
    }
    if (essays.length === 0) {
      toast.error("Tidak ada soal esai pada kuis ini")
      return
    }
    onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <AttemptAnswers questions={questions} attempt={attempt} />
      {essays.map((q, i) => (
        <div key={q.id} className="space-y-1.5">
          <Label htmlFor={`essay-score-${q.id}`}>
            Nilai esai {i + 1} (0–{q.points ?? 1})
          </Label>
          <Input
            id={`essay-score-${q.id}`}
            type="number"
            min={0}
            max={q.points ?? 1}
            value={scores[q.id] ?? ""}
            onChange={(e) => setScores((prev) => ({ ...prev, [q.id]: e.target.value }))}
            className="max-w-32"
          />
        </div>
      ))}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? "Menyimpan..." : "Simpan Nilai"}
        </Button>
      </div>
    </form>
  )
}
