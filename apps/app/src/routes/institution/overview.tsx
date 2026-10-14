import { useQuery } from "@tanstack/react-query"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"

import { EmptyState } from "@/components/composed/_shared/empty-state"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { CourseStatusBadge } from "@/components/composed/courses/_atoms/course-status-badge"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { InstitutionScoped } from "@/components/composed/institutions/institution-scoped"
import { apiGet } from "@/lib/api"
import type { ContractInstitutionReport } from "@workspace/contracts/domain"

/**
 * An owner's home: the same funnel-and-money view the admin dashboard
 * gives the platform, scoped to the institution the sidebar's switcher
 * is pointing at. One `/institutions/{id}/report` call — the counts are
 * aggregated server-side rather than assembled from per-course lists.
 */

function StatFigure({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent>
        <StatFigure label={label} value={value} />
      </CardContent>
    </Card>
  )
}

export function InstitutionOverviewPage() {
  return <InstitutionScoped>{(institution) => <Overview institutionId={institution.id} />}</InstitutionScoped>
}

function Overview({ institutionId }: { institutionId: string }) {
  const report = useQuery({
    queryKey: ["institution-report", institutionId],
    queryFn: () => apiGet<ContractInstitutionReport>(`/institutions/${institutionId}/report`),
  })

  const r = report.data

  return (
    <div className="space-y-6">
      <PageHeader
        title={r?.name ?? "Ringkasan Institusi"}
        description="Corong peserta untuk seluruh pelatihan institusi ini."
      />

      {report.isLoading ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
          <Skeleton className="h-48 w-full" />
        </>
      ) : report.isError ? (
        <ErrorState error={report.error} onRetry={() => void report.refetch()} />
      ) : r ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Pelatihan" value={r.courseCount} />
            <Stat label="Pendaftar" value={r.registrantCount} />
            <Stat label="Peserta" value={r.participantCount} />
            <Stat label="Lulusan" value={r.graduatedCount} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Partisipasi</CardTitle>
              <CardDescription>Dihitung dari pendaftaran institusi ini.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatFigure label="Pelatihan Terbit" value={r.publishedCourseCount} />
              <StatFigure label="Tingkat Kelulusan" value={`${r.completionRate}%`} />
              <StatFigure label="Pendaftar" value={r.registrantCount} />
              <StatFigure label="Peserta" value={r.participantCount} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Per Pelatihan</CardTitle>
            </CardHeader>
            <CardContent>
              {r.byCourse.length === 0 ? (
                <EmptyState
                  compact
                  title="Belum ada pelatihan"
                  description="Buat pelatihan pertama institusi ini dari Kelola Pelatihan."
                />
              ) : (
                <div className="overflow-hidden rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pelatihan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Pendaftar</TableHead>
                        <TableHead className="text-right">Peserta</TableHead>
                        <TableHead className="text-right">Lulus</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {r.byCourse.map((row) => (
                        <TableRow key={row.courseId}>
                          <TableCell className="font-medium">{row.title}</TableCell>
                          <TableCell>
                            <CourseStatusBadge status={row.status} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{row.registrantCount}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.participantCount}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.graduatedCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
