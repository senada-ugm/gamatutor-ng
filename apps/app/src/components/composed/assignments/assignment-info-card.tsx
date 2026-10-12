import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Label } from "@workspace/ui/components/label"

import { formatCourseDate } from "@/lib/lms-date"
import type { ContractAssignment } from "@workspace/contracts/domain"

export function AssignmentInfoCard({ assignment: a }: { assignment: ContractAssignment }) {
  return (
    <Card>
      <CardContent className="space-y-3">
        {a.dueDate ? (
          <div>
            <Badge variant="outline">Tenggat {formatCourseDate(a.dueDate, { full: false })}</Badge>
          </div>
        ) : null}
        <div className="grid gap-3 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Skor Maksimum</p>
            <p className="font-medium">{a.maxScore} poin</p>
          </div>
          <div>
            <p className="text-muted-foreground">Kebijakan Keterlambatan</p>
            <p className="font-medium">
              {a.allowLateSubmission ? `Diizinkan, denda ${a.lateSubmissionPenalty}%` : "Tidak diizinkan"}
            </p>
          </div>
        </div>

        {a.instructions ? (
          <div>
            <Label className="mb-1.5">Instruksi</Label>
            <p className="text-sm whitespace-pre-wrap">{a.instructions}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
