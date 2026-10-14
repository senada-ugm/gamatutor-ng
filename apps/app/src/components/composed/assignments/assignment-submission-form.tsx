import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"

import { FileUploadWidget } from "@/components/composed/player/file-upload-widget"
import { isCourseDatePast } from "@/lib/lms-date"
import type {
  ContractAssignment,
  ContractAssignmentAttachment,
  ContractAssignmentSubmission,
} from "@workspace/contracts/domain"

export interface AssignmentSubmissionFormProps {
  assignment: ContractAssignment
  submission?: ContractAssignmentSubmission
  submitting: boolean
  onSubmit: (data: { content: string; attachmentUploadIds: string[] }) => void
}

export function AssignmentSubmissionForm({
  assignment: a,
  submission,
  submitting,
  onSubmit,
}: AssignmentSubmissionFormProps) {
  const [content, setContent] = useState(submission?.content ?? "")
  const [attachments, setAttachments] = useState<ContractAssignmentAttachment[]>(submission?.attachments ?? [])
  const [error, setError] = useState<string | null>(null)

  const isPastDue = isCourseDatePast(a.dueDate)
  const isGraded = submission?.status === "graded"
  const isBlocked = isGraded || (isPastDue && !a.allowLateSubmission)
  const willBeLate = !isGraded && isPastDue && a.allowLateSubmission

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() && attachments.length === 0) {
      setError("Isi jawaban atau lampirkan setidaknya satu file.")
      return
    }
    setError(null)
    onSubmit({
      content,
      attachmentUploadIds: attachments.map((att) => att.uploadId),
    })
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <h2 className="font-medium">{submission ? "Kirim Ulang Tugas" : "Kirim Tugas"}</h2>

        {isGraded ? (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            Tugas Anda sudah dinilai. Minta instruktur membuka kembali pengumpulan sebelum mengirim ulang.
          </div>
        ) : null}
        {!isGraded && isBlocked ? (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            Batas waktu telah lewat dan pengiriman terlambat tidak diizinkan untuk tugas ini.
          </div>
        ) : null}
        {willBeLate ? (
          <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            Batas waktu telah lewat. Pengiriman ini akan dikenakan denda {a.lateSubmissionPenalty}%.
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="content">Jawaban</Label>
            <Textarea
              id="content"
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tulis jawaban Anda di sini"
              disabled={isBlocked}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Lampiran</Label>
            <FileUploadWidget
              allowedFileTypes={a.allowedFileTypes}
              maxFileSize={a.maxFileSize ?? 10 * 1024 * 1024}
              maxFiles={a.maxFiles}
              value={attachments}
              onChange={setAttachments}
              disabled={isBlocked}
            />
          </div>

          <Button type="submit" disabled={isBlocked || submitting} className="w-fit">
            {submitting ? "Mengirim..." : submission ? "Kirim Ulang" : "Kirim Tugas"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
