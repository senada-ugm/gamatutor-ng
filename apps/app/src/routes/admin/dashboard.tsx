import { useQuery } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Download } from "lucide-react"

import { EmptyState } from "@/components/composed/_shared/empty-state"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { apiGet } from "@/lib/api"
import type { ContractAdminOverview, ContractHealthStatus } from "@workspace/contracts/domain"

/** A top-level stat gets its own card; one nested inside a card is a
 *  plain figure, so a ring never sits inside a ring. */
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent>
        <StatFigure label={label} value={value} />
      </CardContent>
    </Card>
  )
}

function StatFigure({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

export function AdminDashboardPage() {
  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => apiGet<ContractAdminOverview>("/admin/overview"),
  })
  const health = useQuery({
    queryKey: ["admin-health"],
    queryFn: () => apiGet<ContractHealthStatus>("/health"),
    refetchInterval: 60000,
  })

  const o = overview.data

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Overview"
        description="Platform statistics and research telemetry."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.open("/v1/reports/telemetry/export", "_blank")
              }}
              className="gap-2 font-medium"
            >
              <Download className="size-4" />
              Export Learning Telemetry (CSV)
            </Button>
            {health.data ? (
              <div className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
                <span
                  className={`size-2 rounded-full ${health.data.status === "ok" ? "bg-emerald-500" : "bg-amber-500"}`}
                />
                <span className="text-muted-foreground">
                  System: {health.data.status === "ok" ? "Normal" : "Degraded"}
                </span>
              </div>
            ) : null}
          </div>
        }
      />

      {overview.isLoading ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-48 w-full" />
        </>
      ) : overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : o ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Pengguna" value={o.totalUsers} />
            <Stat label="Institusi" value={o.totalInstitutions} />
            <Stat label="Pelatihan" value={o.totalCourses} />
            <Stat label="Pendaftaran" value={o.totalEnrollments} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Partisipasi Peserta</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatFigure label="Peserta Aktif" value={o.activeParticipants} />
                <StatFigure label="Lulusan" value={o.graduatedParticipants} />
                <StatFigure label="Tingkat Penyelesaian" value={`${o.completionRate}%`} />
                <StatFigure label="Pengguna Baru (30 hari)" value={o.growth30d.newUsers} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState title="Ringkasan tidak tersedia" />
      )}
    </div>
  )
}
