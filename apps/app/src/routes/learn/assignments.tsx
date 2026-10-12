import { Link, useParams } from "@tanstack/react-router"
import { Fragment } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Badge } from "@workspace/ui/components/badge"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { BackLink } from "@/components/composed/_shared/back-link"
import { EmptyState } from "@/components/composed/_shared/empty-state"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { AssignmentInfoCard } from "@/components/composed/assignments/assignment-info-card"
import { MySubmissionCard } from "@/components/composed/assignments/assignment-submission-card"
import { AssignmentSubmissionForm } from "@/components/composed/assignments/assignment-submission-form"
import { apiGet, apiSend } from "@/lib/api"
import { formatCourseDate, formatRelativeDueDate, isCourseDatePast } from "@/lib/lms-date"
import type { ContractAssignment, ContractAssignmentSubmission } from "@workspace/contracts/domain"

export function AssignmentListPage() {
  const { courseId } = useParams({ from: "/learn/$courseId/assignments" })
  const assignments = useQuery({
    queryKey: ["assignments", courseId],
    queryFn: () => apiGet<ContractAssignment[]>(`/courses/${courseId}/assignments?pageSize=100`),
  })

  if (assignments.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tugas" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!assignments.data || assignments.data.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tugas" />
        <EmptyState title="Belum ada tugas" description="Tugas akan muncul di sini setelah instruktur membuatnya." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Tugas" />
      <ItemGroup>
        {assignments.data.map((assignment, index) => {
          const pastDue = isCourseDatePast(assignment.dueDate)
          return (
            <Fragment key={assignment.id}>
              {index > 0 ? <ItemSeparator /> : null}
              <Item
                render={
                  <Link
                    to="/learn/$courseId/assignments/$assignmentId"
                    params={{ courseId, assignmentId: assignment.id }}
                    aria-label={assignment.title}
                  />
                }
              >
                <ItemContent>
                  <ItemTitle>{assignment.title}</ItemTitle>
                  <ItemDescription className="line-clamp-1 text-xs">
                    {assignment.maxScore} poin ·{" "}
                    {assignment.dueDate ? (
                      <span className={pastDue ? "text-destructive" : undefined}>
                        Tenggat {formatCourseDate(assignment.dueDate, { full: false })}
                      </span>
                    ) : (
                      "Tanpa batas waktu"
                    )}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  {assignment.dueDate ? (
                    <Badge variant={pastDue ? "destructive" : "outline"} className="shrink-0">
                      {formatRelativeDueDate(assignment.dueDate)}
                    </Badge>
                  ) : null}
                </ItemActions>
              </Item>
            </Fragment>
          )
        })}
      </ItemGroup>
    </div>
  )
}

export function AssignmentDetailPage() {
  const { courseId, assignmentId } = useParams({
    from: "/learn/$courseId/assignments/$assignmentId",
  })
  const queryClient = useQueryClient()

  const assignment = useQuery({
    queryKey: ["assignment", assignmentId],
    queryFn: () => apiGet<ContractAssignment>(`/assignments/${assignmentId}`),
  })

  // Same endpoint backs the grading list (managers) and a student's "my
  // submission" lookup — for a student it returns 0 or 1 row.
  const mySubmission = useQuery({
    queryKey: ["assignment-submissions", assignmentId],
    queryFn: () => apiGet<ContractAssignmentSubmission[]>(`/assignments/${assignmentId}/submissions?pageSize=10`),
  })

  const submit = useMutation({
    mutationFn: (data: { content: string; attachmentUploadIds: string[] }) =>
      apiSend<ContractAssignmentSubmission>("POST", `/assignments/${assignmentId}/submissions`, data),
    onSuccess: () => {
      toast.success("Tugas terkirim")
      void queryClient.invalidateQueries({
        queryKey: ["assignment-submissions", assignmentId],
      })
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Gagal mengirim tugas"),
  })

  if (assignment.isLoading || mySubmission.isLoading) {
    return <Skeleton className="h-64 w-full" />
  }
  if (!assignment.data) {
    return (
      <div className="space-y-4">
        <BackLink to="/learn/$courseId/assignments" params={{ courseId }} label="Kembali ke Tugas" />
        <p className="py-8 text-center text-muted-foreground">Tugas tidak ditemukan.</p>
      </div>
    )
  }

  const submission = mySubmission.data?.[0]
  return (
    <div className="space-y-6">
      <PageHeader
        backTo="/learn/$courseId/assignments"
        backParams={{ courseId }}
        backLabel="Kembali ke Tugas"
        title={assignment.data.title}
        description={assignment.data.description ?? undefined}
      />
      <AssignmentInfoCard assignment={assignment.data} />
      {submission ? <MySubmissionCard submission={submission} /> : null}
      <AssignmentSubmissionForm
        key={submission?.id ?? "new"}
        assignment={assignment.data}
        submission={submission}
        submitting={submit.isPending}
        onSubmit={(data) => submit.mutate(data)}
      />
    </div>
  )
}
