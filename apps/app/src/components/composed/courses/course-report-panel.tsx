import { useQuery } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"

import { EnrollmentStatusBadge } from "@/components/composed/_shared/enrollment-status-badge"
import { EmptyState } from "@/components/composed/_shared/empty-state"
import { API_URL, apiGet } from "@/lib/api"
import type { ContractCourseReport } from "@workspace/contracts/domain"

/**
 * The course editor's Laporan tab: the per-participant funnel/progress/
 * attendance table from GET /courses/{id}/report, plus the operational
 * CSV export (contracted data, operational file formatting).
 */

export function CourseReportPanel({ courseId }: { courseId: string }) {
  const report = useQuery({
    queryKey: ["course-report", courseId],
    queryFn: () => apiGet<ContractCourseReport>(`/courses/${courseId}/report`),
  })

  if (report.isLoading) {
    return <Skeleton className="h-64 w-full" />
  }
  if (!report.data) {
    return <EmptyState title="Laporan tidak tersedia" />
  }

  const r = report.data

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium">Laporan Pelatihan</h2>
          <p className="text-sm text-muted-foreground">
            {r.registrantCount} pendaftar · {r.participantCount} peserta · {r.totalLessons} pelajaran ·{" "}
            {r.totalSessions} sesi
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={
            <a
              href={`${API_URL}/v1/courses/${courseId}/participants/export`}
              // Cookie-authenticated download — a plain navigation, not fetch.
              onClick={(e) => {
                e.preventDefault()
                window.open(`${API_URL}/v1/courses/${courseId}/participants/export`, "_blank")
              }}
            />
          }
        >
          Unduh CSV
        </Button>
      </div>

      {r.participants.length === 0 ? (
        <EmptyState title="Belum ada peserta" description="Laporan terisi setelah peserta diterima." />
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Peserta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progres</TableHead>
                <TableHead>Kehadiran</TableHead>
                <TableHead>Nilai Akhir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.participants.map((participant) => (
                <TableRow key={participant.user.id}>
                  <TableCell>
                    <p className="font-medium">{participant.user.name}</p>
                    <p className="text-xs text-muted-foreground">{participant.user.email}</p>
                  </TableCell>
                  <TableCell>
                    <EnrollmentStatusBadge status={participant.enrollmentStatus} />
                  </TableCell>
                  <TableCell>{participant.progressPercent}%</TableCell>
                  <TableCell>
                    {participant.attendance.attendancePercent}%{" "}
                    <span className="text-xs text-muted-foreground">
                      ({participant.attendance.present}H/{participant.attendance.late}T/
                      {participant.attendance.absent}A)
                    </span>
                  </TableCell>
                  <TableCell>{participant.finalGrade ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
