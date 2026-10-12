import { useQuery } from "@tanstack/react-query"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"

import { EmptyState } from "@/components/composed/_shared/empty-state"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { apiGet } from "@/lib/api"
import { formatRupiah } from "@/lib/format"
import type { ContractAdminOverview, ContractFinancialSummary, ContractHealthStatus } from "@workspace/contracts/domain"

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
  const financial = useQuery({
    queryKey: ["admin-financial"],
    queryFn: () => apiGet<ContractFinancialSummary>("/admin/financial-summary"),
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
        title="Ringkasan"
        description="Statistik platform dan arus dana."
        actions={
          health.data ? (
            <div className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
              <span
                className={`size-2 rounded-full ${health.data.status === "ok" ? "bg-emerald-500" : "bg-amber-500"}`}
              />
              <span className="text-muted-foreground">
                Sistem: {health.data.status === "ok" ? "Normal" : "Degradasi"}
              </span>
            </div>
          ) : null
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

          <Card>
            <CardHeader>
              <CardTitle>Ringkasan Keuangan</CardTitle>
              <CardDescription>Dihitung dari pesanan lunas dan tertunda.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {financial.isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : financial.data ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatFigure label="Pendapatan" value={formatRupiah(financial.data.totalRevenue)} />
                    <StatFigure label="Diskon Diberikan" value={formatRupiah(financial.data.totalDiscountGiven)} />
                    <StatFigure label="Pesanan Lunas" value={financial.data.paidOrders} />
                    <StatFigure label="Menunggu Bayar" value={financial.data.pendingOrders} />
                  </div>
                  {financial.data.byCourse.length > 0 ? (
                    <div className="overflow-hidden rounded-xl border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Pelatihan</TableHead>
                            <TableHead>Lunas</TableHead>
                            <TableHead>Pendapatan</TableHead>
                            <TableHead>Tertunda</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {financial.data.byCourse.map((row) => (
                            <TableRow key={row.courseId}>
                              <TableCell className="font-medium">{row.courseTitle}</TableCell>
                              <TableCell>{row.paidOrders}</TableCell>
                              <TableCell>{formatRupiah(row.revenue)}</TableCell>
                              <TableCell>{row.pendingOrders}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : null}
                </>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState title="Ringkasan tidak tersedia" />
      )}
    </div>
  )
}
