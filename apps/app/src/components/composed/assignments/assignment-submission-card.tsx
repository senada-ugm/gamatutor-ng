import { Card, CardContent } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { AssignmentSubmissionBadge } from "@/components/composed/_shared/assignment-submission-badge"
import { formatCourseDate } from "@/lib/lms-date"
import type { ContractAssignmentSubmission } from "@workspace/contracts/domain"

export function MySubmissionCard({ submission }: { submission: ContractAssignmentSubmission }) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Pengumpulan Anda</h2>
          <AssignmentSubmissionBadge status={submission.status} />
        </div>
        <p className="text-xs text-muted-foreground">
          Dikumpulkan {submission.submittedAt ? formatCourseDate(submission.submittedAt, { full: false }) : "-"}
          {submission.isLate ? " (terlambat)" : ""}
        </p>
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

        {submission.score !== undefined && submission.score !== null ? (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-medium">Nilai:</span> {submission.score}
              </p>
              {submission.feedback ? <p className="text-sm text-muted-foreground">{submission.feedback}</p> : null}
              {submission.gradedAt ? (
                <p className="text-xs text-muted-foreground">Dinilai pada {formatCourseDate(submission.gradedAt)}</p>
              ) : null}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
