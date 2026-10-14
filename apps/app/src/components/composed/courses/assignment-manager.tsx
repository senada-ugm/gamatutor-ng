import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Textarea } from "@workspace/ui/components/textarea"

import { AssignmentSubmissionBadge } from "@/components/composed/_shared/assignment-submission-badge"
import { BackLink } from "@/components/composed/_shared/back-link"
import { EmptyState } from "@/components/composed/_shared/empty-state"
import { useConfirm } from "@/components/composed/_shared/confirm-dialog"
import { apiGet, apiSend } from "@/lib/api"
import { formatCourseDate, isCourseDatePast, toDateTimeLocalValue } from "@/lib/lms-date"
import type { ContractAssignment, ContractAssignmentSubmission } from "@workspace/contracts/domain"

/**
 * Penilaian tab: assignment authoring + the grading queue. The same
 * submissions endpoint returns every row for course managers (only the
 * caller's own for students), so this doubles as the instructor's view
 * of who has submitted.
 */

export function AssignmentManager({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const assignments = useQuery({
    queryKey: ["assignments", courseId],
    queryFn: () => apiGet<ContractAssignment[]>(`/courses/${courseId}/assignments?pageSize=100`),
  })

  const createAssignment = useMutation({
    mutationFn: (values: AssignmentFormValues) =>
      apiSend<ContractAssignment>("POST", `/courses/${courseId}/assignments`, toAssignmentPayload(values)),
    onSuccess: () => {
      toast.success("Tugas dibuat")
      setShowCreate(false)
      void queryClient.invalidateQueries({ queryKey: ["assignments", courseId] })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal membuat tugas"),
  })

  const updateAssignment = useMutation({
    mutationFn: (input: { id: string; values: AssignmentFormValues }) =>
      apiSend<ContractAssignment>("PATCH", `/assignments/${input.id}`, toAssignmentPayload(input.values)),
    onSuccess: () => {
      toast.success("Tugas diperbarui")
      setEditingId(null)
      void queryClient.invalidateQueries({ queryKey: ["assignments", courseId] })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal memperbarui tugas"),
  })

  const removeAssignment = useMutation({
    mutationFn: (id: string) => apiSend<null>("DELETE", `/assignments/${id}`),
    onSuccess: () => {
      toast.success("Tugas dihapus")
      void queryClient.invalidateQueries({ queryKey: ["assignments", courseId] })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menghapus tugas"),
  })

  // assignment_submissions cascades on the assignment's delete, so the
  // count is the consequence worth naming before anyone confirms.
  function confirmRemove(assignment: ContractAssignment) {
    void confirm({
      title: "Hapus tugas?",
      description:
        assignment.submissionCount > 0
          ? `"${assignment.title}" beserta ${assignment.submissionCount} pengumpulan peserta akan dihapus permanen.`
          : `"${assignment.title}" akan dihapus permanen.`,
      confirmLabel: "Hapus",
      destructive: true,
    }).then((ok) => {
      if (ok) removeAssignment.mutate(assignment.id)
    })
  }

  if (selectedId) {
    return <GradingView assignmentId={selectedId} onBack={() => setSelectedId(null)} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Penilaian</h2>
        <Button
          onClick={() => {
            setEditingId(null)
            setShowCreate((v) => !v)
          }}
        >
          Tugas Baru
        </Button>
      </div>

      {showCreate ? (
        <AssignmentForm
          submitLabel="Buat Tugas"
          submitting={createAssignment.isPending}
          onSubmit={(values) => createAssignment.mutate(values)}
          onCancel={() => setShowCreate(false)}
        />
      ) : null}

      {assignments.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (assignments.data ?? []).length === 0 ? (
        <EmptyState title="Belum ada tugas" description="Buat tugas pertama untuk pelatihan ini." />
      ) : (
        <div className="space-y-3">
          {(assignments.data ?? []).map((assignment) => {
            const pastDue = isCourseDatePast(assignment.dueDate)
            if (editingId === assignment.id) {
              return (
                <AssignmentForm
                  key={assignment.id}
                  initial={assignmentFormValuesFromAssignment(assignment)}
                  submitLabel="Simpan Perubahan"
                  submitting={updateAssignment.isPending}
                  onSubmit={(values) => updateAssignment.mutate({ id: assignment.id, values })}
                  onCancel={() => setEditingId(null)}
                />
              )
            }
            return (
              <Card key={assignment.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-medium">{assignment.title}</h3>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{assignment.maxScore} poin</span>
                      <span>{assignment.submissionCount} dikumpulkan</span>
                      {assignment.dueDate ? (
                        <span className={pastDue ? "text-destructive" : undefined}>
                          Tenggat {formatCourseDate(assignment.dueDate, { full: false })}
                        </span>
                      ) : (
                        <span>Tanpa batas waktu</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => setSelectedId(assignment.id)}>
                      Nilai
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowCreate(false)
                        setEditingId(assignment.id)
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={removeAssignment.isPending}
                      onClick={() => confirmRemove(assignment)}
                    >
                      Hapus
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// --- Assignment create form --------------------------------------------------

interface AssignmentFormValues {
  title: string
  instructions: string
  maxScore: string
  dueDate: string
  allowLateSubmission: boolean
  lateSubmissionPenalty: string
  allowedFileTypes: string
  maxFiles: string
}

function toAssignmentPayload(values: AssignmentFormValues) {
  return {
    title: values.title,
    instructions: values.instructions || undefined,
    maxScore: values.maxScore ? Number(values.maxScore) : undefined,
    dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : undefined,
    allowLateSubmission: values.allowLateSubmission,
    lateSubmissionPenalty: values.lateSubmissionPenalty ? Number(values.lateSubmissionPenalty) : undefined,
    allowedFileTypes: values.allowedFileTypes
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    maxFiles: values.maxFiles ? Number(values.maxFiles) : undefined,
  }
}

function assignmentFormValuesFromAssignment(a: ContractAssignment): AssignmentFormValues {
  return {
    title: a.title,
    instructions: a.instructions ?? "",
    maxScore: String(a.maxScore),
    dueDate: toDateTimeLocalValue(a.dueDate),
    allowLateSubmission: a.allowLateSubmission,
    lateSubmissionPenalty: String(a.lateSubmissionPenalty),
    allowedFileTypes: a.allowedFileTypes.join(", "),
    maxFiles: String(a.maxFiles),
  }
}

function AssignmentForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial?: AssignmentFormValues
  submitLabel: string
  submitting: boolean
  onSubmit: (values: AssignmentFormValues) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState<AssignmentFormValues>(
    initial ?? {
      title: "",
      instructions: "",
      maxScore: "100",
      dueDate: "",
      allowLateSubmission: true,
      lateSubmissionPenalty: "10",
      allowedFileTypes: "application/pdf",
      maxFiles: "3",
    }
  )

  function update<TKey extends keyof AssignmentFormValues>(key: TKey, value: AssignmentFormValues[TKey]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.title.trim()) {
      toast.error("Judul tugas wajib diisi")
      return
    }
    onSubmit(values)
  }

  return (
    <Card className="max-w-3xl">
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="assignment-title">Judul</Label>
            <Input id="assignment-title" value={values.title} onChange={(e) => update("title", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assignment-instructions">Instruksi</Label>
            <Textarea
              id="assignment-instructions"
              rows={4}
              value={values.instructions}
              onChange={(e) => update("instructions", e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="assignment-maxscore">Skor Maksimum</Label>
              <Input
                id="assignment-maxscore"
                type="number"
                min={1}
                value={values.maxScore}
                onChange={(e) => update("maxScore", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assignment-duedate">Tenggat Waktu</Label>
              <Input
                id="assignment-duedate"
                type="datetime-local"
                value={values.dueDate}
                onChange={(e) => update("dueDate", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.allowLateSubmission}
                onCheckedChange={(c) => update("allowLateSubmission", c === true)}
              />
              Izinkan pengumpulan terlambat
            </label>
            {values.allowLateSubmission ? (
              <div className="space-y-1.5">
                <Label htmlFor="assignment-penalty">Denda Keterlambatan (%)</Label>
                <Input
                  id="assignment-penalty"
                  type="number"
                  min={0}
                  max={100}
                  value={values.lateSubmissionPenalty}
                  onChange={(e) => update("lateSubmissionPenalty", e.target.value)}
                />
              </div>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="assignment-filetypes">Tipe File Diizinkan (MIME, koma)</Label>
              <Input
                id="assignment-filetypes"
                value={values.allowedFileTypes}
                onChange={(e) => update("allowedFileTypes", e.target.value)}
                placeholder="application/pdf, image/png"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assignment-maxfiles">Maks. File</Label>
              <Input
                id="assignment-maxfiles"
                type="number"
                min={1}
                value={values.maxFiles}
                onChange={(e) => update("maxFiles", e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Catatan: server memverifikasi tipe file dari isi file (bukan klaim klien) — teks, PDF, gambar, dan dokumen
            Office terdeteksi otomatis.
          </p>
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Menyimpan..." : submitLabel}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Batal
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// --- Grading queue ------------------------------------------------------------

function GradingView({ assignmentId, onBack }: { assignmentId: string; onBack: () => void }) {
  const queryClient = useQueryClient()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const assignment = useQuery({
    queryKey: ["assignment", assignmentId],
    queryFn: () => apiGet<ContractAssignment>(`/assignments/${assignmentId}`),
  })

  const submissions = useQuery({
    queryKey: ["assignment-submissions", assignmentId],
    queryFn: () => apiGet<ContractAssignmentSubmission[]>(`/assignments/${assignmentId}/submissions?pageSize=100`),
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["assignment-submissions", assignmentId] })
  }

  const grade = useMutation({
    mutationFn: (input: { id: string; score: number; feedback: string }) =>
      apiSend<ContractAssignmentSubmission>("POST", `/assignment-submissions/${input.id}/grade`, {
        score: input.score,
        feedback: input.feedback || undefined,
      }),
    onSuccess: () => {
      toast.success("Nilai disimpan")
      setExpandedId(null)
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menilai"),
  })

  const reopen = useMutation({
    mutationFn: (submissionId: string) =>
      apiSend<ContractAssignmentSubmission>("POST", `/assignment-submissions/${submissionId}/return`),
    onSuccess: () => {
      toast.success("Pengumpulan dibuka kembali untuk revisi")
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal membuka kembali"),
  })

  if (assignment.isLoading || submissions.isLoading) {
    return <Skeleton className="h-48 w-full" />
  }
  if (!assignment.data) {
    return <p className="py-8 text-center text-muted-foreground">Tugas tidak ditemukan.</p>
  }

  const a = assignment.data
  const rows = submissions.data ?? []

  return (
    <div className="space-y-4">
      <div>
        <BackLink onClick={onBack} label="Kembali ke Penilaian" />
        <h2 className="text-lg font-medium">{a.title}</h2>
        <p className="text-sm text-muted-foreground">
          {rows.length} pengumpulan · maks {a.maxScore} poin
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Belum ada pengumpulan"
          description="Peserta yang mengumpulkan tugas ini akan muncul di sini."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((submission) => {
            const isExpanded = expandedId === submission.id
            return (
              <Card key={submission.id}>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{submission.user.name || submission.user.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {submission.submittedAt
                          ? `Dikumpulkan ${formatCourseDate(submission.submittedAt, { full: false })}`
                          : "Belum dikumpulkan"}
                        {submission.isLate ? " · terlambat" : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {submission.score != null ? (
                        <Badge variant="outline">
                          {submission.score}/{a.maxScore}
                        </Badge>
                      ) : null}
                      <AssignmentSubmissionBadge status={submission.status} />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExpandedId(isExpanded ? null : submission.id)}
                      >
                        {isExpanded ? "Tutup" : "Periksa"}
                      </Button>
                    </div>
                  </div>

                  {isExpanded ? (
                    <SubmissionDetailView
                      submissionId={submission.id}
                      fallback={submission}
                      maxScore={a.maxScore}
                      onGrade={(score, feedback) => grade.mutate({ id: submission.id, score, feedback })}
                      onReopen={() => reopen.mutate(submission.id)}
                      isGrading={grade.isPending}
                      isReopening={reopen.isPending}
                    />
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SubmissionDetailView({
  submissionId,
  fallback,
  maxScore,
  onGrade,
  onReopen,
  isGrading,
  isReopening,
}: {
  submissionId: string
  fallback: ContractAssignmentSubmission
  maxScore: number
  onGrade: (score: number, feedback: string) => void
  onReopen: () => void
  isGrading: boolean
  isReopening: boolean
}) {
  const query = useQuery({
    queryKey: ["assignment-submission", submissionId],
    queryFn: () => apiGet<ContractAssignmentSubmission>(`/assignment-submissions/${submissionId}`),
    initialData: fallback,
  })
  const submission = query.data ?? fallback
  return (
    <>
      <Separator />
      {submission.content ? <p className="text-sm whitespace-pre-wrap">{submission.content}</p> : null}
      {submission.attachments.length > 0 ? (
        <ul className="space-y-1">
          {submission.attachments.map((att) => (
            <li key={att.uploadId} className="text-sm">
              <a href={att.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                {att.name}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {submission.status === "graded" ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Sudah dinilai{submission.feedback ? `: "${submission.feedback}"` : ""}.
          </p>
          <Button size="sm" variant="outline" disabled={isReopening} onClick={onReopen}>
            Buka Kembali untuk Revisi
          </Button>
        </div>
      ) : (
        <GradeForm
          maxScore={maxScore}
          submitting={isGrading}
          onSubmit={(score, feedback) => onGrade(score, feedback)}
        />
      )}
    </>
  )
}

function GradeForm({
  maxScore,
  submitting,
  onSubmit,
}: {
  maxScore: number
  submitting: boolean
  onSubmit: (score: number, feedback: string) => void
}) {
  const [score, setScore] = useState("")
  const [feedback, setFeedback] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = Number(score)
    if (score === "" || Number.isNaN(parsed) || parsed < 0 || parsed > maxScore) {
      toast.error(`Isi nilai antara 0 dan ${maxScore}`)
      return
    }
    onSubmit(parsed, feedback)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`score-${maxScore}`}>Nilai (0–{maxScore})</Label>
          <Input
            id={`score-${maxScore}`}
            type="number"
            min={0}
            max={maxScore}
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="grade-feedback">Umpan Balik</Label>
          <Input
            id="grade-feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="opsional"
          />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={submitting}>
        {submitting ? "Menyimpan..." : "Simpan Nilai"}
      </Button>
    </form>
  )
}
