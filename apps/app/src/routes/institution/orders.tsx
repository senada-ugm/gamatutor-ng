import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { Download } from "lucide-react"

import { EmptyState } from "@/components/composed/_shared/empty-state"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { Pager } from "@/components/composed/_shared/pager"
import { InstitutionScoped } from "@/components/composed/institutions/institution-scoped"
import { OrderStatusBadge } from "@/components/composed/payments/_atoms/order-status-badge"
import { API_URL, apiGet, apiGetPaged } from "@/lib/api"
import { formatRupiah } from "@/lib/format"
import { formatCourseDate } from "@/lib/lms-date"
import type { ContractInstitutionReport, ContractOrder } from "@workspace/contracts/domain"

/**
 * The institution's order book. Confirming or refunding a payment stays
 * in the course editor's Pembayaran tab, which is where the course
 * context that decision needs already is — this is the owner's
 * cross-course ledger.
 */

const PAGE_SIZE = 25
const STATUSES = [
  { value: "pending", label: "Menunggu Pembayaran" },
  { value: "paid", label: "Lunas" },
  { value: "canceled", label: "Dibatalkan" },
  { value: "refunded", label: "Dikembalikan" },
]

export function InstitutionOrdersPage() {
  return <InstitutionScoped>{(institution) => <Orders institutionId={institution.id} />}</InstitutionScoped>
}

function Orders({ institutionId }: { institutionId: string }) {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState("")

  const orders = useQuery({
    queryKey: ["institution-orders", institutionId, page, status],
    queryFn: () =>
      apiGetPaged<ContractOrder>(
        `/orders?institutionId=${institutionId}&page=${page}&pageSize=${PAGE_SIZE}${status ? `&status=${status}` : ""}`
      ),
  })

  // Course titles come off the institution report rather than a second
  // course list: it already names every course under the institution and
  // the overview page has usually warmed it.
  const report = useQuery({
    queryKey: ["institution-report", institutionId],
    queryFn: () => apiGet<ContractInstitutionReport>(`/institutions/${institutionId}/report`),
  })
  const courseTitles = new Map((report.data?.byCourse ?? []).map((c) => [c.courseId, c.title]))

  const rows = orders.data?.data ?? []
  const pageRevenue = rows.filter((o) => o.status === "paid").reduce((sum, o) => sum + o.finalAmount, 0)

  return (
    <div className="space-y-6">
      <PageHeader title="Pembayaran" description="Seluruh pesanan pelatihan di bawah institusi ini." />

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <NativeSelect
                aria-label="Saring status"
                className="w-56"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value ?? "")
                  setPage(1)
                }}
              >
                <NativeSelectOption value="">Semua status</NativeSelectOption>
                {STATUSES.map((s) => (
                  <NativeSelectOption key={s.value} value={s.value}>
                    {s.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {orders.data ? (
                <p className="text-sm text-muted-foreground">
                  {orders.data.pagination.totalCount} pesanan
                  {pageRevenue > 0 ? ` · ${formatRupiah(pageRevenue)} lunas di halaman ini` : ""}
                </p>
              ) : null}
            </div>

            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={
                <a
                  href={`${API_URL}/v1/institutions/${institutionId}/orders/export`}
                  onClick={(e) => {
                    e.preventDefault()
                    window.open(`${API_URL}/v1/institutions/${institutionId}/orders/export`, "_blank")
                  }}
                />
              }
            >
              <Download className="mr-2 size-4" />
              Ekspor CSV
            </Button>
          </div>

          {orders.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : orders.isError ? (
            <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              compact
              title="Belum ada pesanan"
              description="Pesanan muncul di sini setelah peserta mendaftar pelatihan berbayar."
            />
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pesanan</TableHead>
                      <TableHead>Pelatihan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                      <TableHead>Dibuat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <p className="font-mono text-xs text-muted-foreground">{order.id}</p>
                          {order.couponCode ? <p className="text-xs">Kupon {order.couponCode}</p> : null}
                        </TableCell>
                        <TableCell>
                          <Link
                            to="/instructor/courses/$courseId/editor/pembayaran"
                            params={{ courseId: order.courseId }}
                            className="underline-offset-4 hover:underline"
                          >
                            {courseTitles.get(order.courseId) ?? "Pelatihan"}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <OrderStatusBadge status={order.status} />
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatRupiah(order.finalAmount)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatCourseDate(order.createdAt, { full: false })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pager
                page={page}
                totalPages={orders.data?.pagination.totalPages ?? 1}
                disabled={orders.isFetching}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
