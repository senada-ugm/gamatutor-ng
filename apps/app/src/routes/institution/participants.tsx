import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import { Card, CardContent } from "@workspace/ui/components/card"
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select"
import { Progress } from "@workspace/ui/components/progress"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"

import { EmptyState } from "@/components/composed/_shared/empty-state"
import { EnrollmentStatusBadge, ENROLLMENT_STATUS } from "@/components/composed/_shared/enrollment-status-badge"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { Pager } from "@/components/composed/_shared/pager"
import { InstitutionScoped } from "@/components/composed/institutions/institution-scoped"
import { apiGet, apiGetPaged } from "@/lib/api"
import { formatCourseDate } from "@/lib/lms-date"
import type {
  ContractEnrollment,
  ContractEnrollmentStatus,
  ContractInstitutionReport,
  ContractParticipantProfile,
} from "@workspace/contracts/domain"

/**
 * Every enrollment under one institution, in one list — previously only
 * reachable a course at a time through each course editor's Peserta tab.
 * The roster actions stay there: this is the institution-wide view an
 * owner reads, not a second place to approve people from.
 */

const PAGE_SIZE = 25

export function InstitutionParticipantsPage() {
  return <InstitutionScoped>{(institution) => <Participants institutionId={institution.id} />}</InstitutionScoped>
}

function Participants({ institutionId }: { institutionId: string }) {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<"" | ContractEnrollmentStatus>("")

  const enrollments = useQuery({
    queryKey: ["institution-enrollments", institutionId, page, status],
    queryFn: () =>
      apiGetPaged<ContractEnrollment>(
        `/enrollments?institutionId=${institutionId}&page=${page}&pageSize=${PAGE_SIZE}${status ? `&status=${status}` : ""}`
      ),
  })

  // Enrollment rows carry only courseId/userId. Course titles come off
  // the institution report, which already names every course under the
  // institution and is cached from the overview page; display names come
  // from a profile read per participant on the page, the same idiom the
  // per-course ParticipantsPanel uses.
  const report = useQuery({
    queryKey: ["institution-report", institutionId],
    queryFn: () => apiGet<ContractInstitutionReport>(`/institutions/${institutionId}/report`),
  })

  const rows = enrollments.data?.data ?? []
  const userIds = [...new Set(rows.map((r) => r.userId))]
  const profiles = useQuery({
    queryKey: ["participant-profiles", "institution", institutionId, userIds.join(",")],
    queryFn: async () => {
      const batch = await apiGet<ContractParticipantProfile[]>(
        `/participant-profiles?userIds=${encodeURIComponent(userIds.join(","))}`
      )
      return new Map(batch.map((row) => [row.id, row]))
    },
    enabled: userIds.length > 0,
  })

  const courseTitles = new Map((report.data?.byCourse ?? []).map((c) => [c.courseId, c.title]))

  return (
    <div className="space-y-6">
      <PageHeader title="Peserta" description="Seluruh pendaftaran di bawah institusi ini." />

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect
              aria-label="Saring status"
              className="w-56"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as "" | ContractEnrollmentStatus)
                setPage(1)
              }}
            >
              <NativeSelectOption value="">Semua status</NativeSelectOption>
              {Object.entries(ENROLLMENT_STATUS).map(([value, config]) => (
                <NativeSelectOption key={value} value={value}>
                  {config.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {enrollments.data ? (
              <p className="text-sm text-muted-foreground">{enrollments.data.pagination.totalCount} pendaftaran</p>
            ) : null}
          </div>

          {enrollments.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : enrollments.isError ? (
            <ErrorState error={enrollments.error} onRetry={() => void enrollments.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              compact
              title="Belum ada pendaftaran"
              description="Pendaftaran akan muncul di sini begitu peserta mendaftar pelatihan institusi ini."
            />
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Peserta</TableHead>
                      <TableHead>Pelatihan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progres</TableHead>
                      <TableHead>Mendaftar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const profile = profiles.data?.get(row.userId)
                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <p className="font-medium">{profile?.name ?? "Memuat..."}</p>
                            {profile?.email ? <p className="text-xs text-muted-foreground">{profile.email}</p> : null}
                          </TableCell>
                          <TableCell>
                            <Link
                              to="/instructor/courses/$courseId/editor/peserta"
                              params={{ courseId: row.courseId }}
                              className="underline-offset-4 hover:underline"
                            >
                              {courseTitles.get(row.courseId) ?? "Pelatihan"}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <EnrollmentStatusBadge status={row.status} />
                          </TableCell>
                          <TableCell className="w-40">
                            <div className="flex items-center gap-2">
                              <Progress value={row.progress} className="h-1.5" />
                              <span className="text-xs text-muted-foreground tabular-nums">{row.progress}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatCourseDate(row.enrolledAt, { full: false })}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <Pager
                page={page}
                totalPages={enrollments.data?.pagination.totalPages ?? 1}
                disabled={enrollments.isFetching}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
