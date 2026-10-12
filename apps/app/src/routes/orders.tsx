import { Fragment, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Label } from "@workspace/ui/components/label"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { CreditCard } from "lucide-react"

import { EmptyState } from "@/components/composed/_shared/empty-state"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { useConfirm } from "@/components/composed/_shared/confirm-dialog"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { Pager } from "@/components/composed/_shared/pager"
import { OrderStatusBadge } from "@/components/composed/payments/_atoms/order-status-badge"
import { apiGet, apiGetPaged, apiSend } from "@/lib/api"
import { formatRupiah } from "@/lib/format"
import { formatCourseDate } from "@/lib/lms-date"
import type { ContractCheckoutSession, ContractOrder } from "@workspace/contracts/domain"

/**
 * My orders: the learner's own payment orders with cancel (while
 * pending) and gateway checkout when configured.
 */

const PAGE_SIZE = 20

export function MyOrdersPage() {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [page, setPage] = useState(1)
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  const orders = useQuery({
    queryKey: ["my-orders", page],
    queryFn: () => apiGetPaged<ContractOrder>(`/orders?page=${page}&pageSize=${PAGE_SIZE}`),
  })

  const orderDetail = useQuery({
    queryKey: ["order-detail", selectedOrderId],
    queryFn: () => apiGet<ContractOrder>(`/orders/${selectedOrderId}`),
    enabled: selectedOrderId !== null,
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["my-orders"] })
  }

  const cancel = useMutation({
    mutationFn: (orderId: string) => apiSend<ContractOrder>("POST", `/orders/${orderId}/cancel`),
    onSuccess: () => {
      toast.success("Pesanan dibatalkan")
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal membatalkan pesanan"),
  })

  const checkout = useMutation({
    mutationFn: (orderId: string) => apiSend<ContractCheckoutSession>("POST", `/orders/${orderId}/checkout`),
    onSuccess: (session) => setCheckoutUrl(session.url),
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Pembayaran gateway belum tersedia — gunakan transfer manual"),
  })

  const [proofRef, setProofRef] = useState("")
  const [proofUrl, setProofUrl] = useState("")

  const submitProof = useMutation({
    mutationFn: (payload: { orderId: string; paymentReference: string; proofUrl?: string }) =>
      apiSend<ContractOrder>("POST", `/orders/${payload.orderId}/submit-proof`, {
        paymentReference: payload.paymentReference,
        proofUrl: payload.proofUrl,
      }),
    onSuccess: () => {
      toast.success("Bukti transfer berhasil dikirim")
      setProofRef("")
      setProofUrl("")
      invalidate()
      if (selectedOrderId) {
        void queryClient.invalidateQueries({ queryKey: ["order-detail", selectedOrderId] })
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal mengirim bukti transfer"),
  })

  const rows = orders.data?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Pesanan Saya" description="Riwayat pembayaran pelatihan." />

      {orders.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : orders.isError ? (
        <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Belum ada pesanan"
          description="Pesanan pembayaran pelatihan berbayar akan muncul di sini."
        />
      ) : (
        <ItemGroup>
          {rows.map((order, index) => (
            <Fragment key={order.id}>
              {index > 0 ? <ItemSeparator /> : null}
              <Item>
                <ItemContent>
                  <ItemTitle>
                    <span className="font-mono text-xs text-muted-foreground">{order.id}</span>
                    <OrderStatusBadge status={order.status} />
                  </ItemTitle>
                  <ItemDescription>
                    {formatCourseDate(order.createdAt, { full: false })}
                    {order.couponCode ? ` · Kupon ${order.couponCode}` : ""}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <span className="text-sm font-bold">{formatRupiah(order.finalAmount)}</span>
                  <Button size="sm" variant="outline" onClick={() => setSelectedOrderId(order.id)}>
                    Detail
                  </Button>
                  {order.status === "pending" ? (
                    <>
                      <Button size="sm" disabled={checkout.isPending} onClick={() => checkout.mutate(order.id)}>
                        Bayar Online
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={cancel.isPending}
                        onClick={() => {
                          void confirm({
                            title: "Batalkan pesanan?",
                            description: "Pesanan ini ditutup dan Anda perlu mendaftar ulang untuk membayar.",
                            confirmLabel: "Batalkan Pesanan",
                            cancelLabel: "Tutup",
                            destructive: true,
                          }).then((ok) => {
                            if (ok) cancel.mutate(order.id)
                          })
                        }}
                      >
                        Batalkan
                      </Button>
                    </>
                  ) : null}
                </ItemActions>
              </Item>
            </Fragment>
          ))}
        </ItemGroup>
      )}

      {selectedOrderId ? (
        <Dialog open={selectedOrderId !== null} onOpenChange={(open) => !open && setSelectedOrderId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detail Pesanan</DialogTitle>
              <DialogDescription>Rincian invoice dan status pembayaran pesanan.</DialogDescription>
            </DialogHeader>
            {orderDetail.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : orderDetail.data ? (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-muted-foreground">ID Pesanan</span>
                    <p className="font-mono text-xs">{orderDetail.data.id}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Status</span>
                    <p>
                      <OrderStatusBadge status={orderDetail.data.status} />
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Tanggal Pesanan</span>
                    <p className="text-muted-foreground">
                      {formatCourseDate(orderDetail.data.createdAt, { full: true })}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Pelatihan ID</span>
                    <p className="font-mono text-xs">{orderDetail.data.courseId}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Harga Asli</span>
                    <p>{formatRupiah(orderDetail.data.originalPrice)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Diskon</span>
                    <p className="text-muted-foreground">
                      {orderDetail.data.discountAmount ? formatRupiah(orderDetail.data.discountAmount) : "—"}
                      {orderDetail.data.couponCode ? ` (Kupon: ${orderDetail.data.couponCode})` : ""}
                    </p>
                  </div>
                  <div className="col-span-2 border-t pt-2">
                    <span className="text-xs text-muted-foreground">Total Tagihan</span>
                    <p className="text-base font-bold text-primary">{formatRupiah(orderDetail.data.finalAmount)}</p>
                  </div>
                </div>

                {orderDetail.data.status === "pending" ? (
                  <div className="space-y-3 pt-2">
                    <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <CreditCard className="size-4 text-primary" />
                        <span>Instruksi Transfer Bank Manual</span>
                      </div>
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        <p>
                          Silakan transfer tepat sejumlah{" "}
                          <span className="font-semibold text-foreground">
                            {formatRupiah(orderDetail.data.finalAmount)}
                          </span>{" "}
                          ke salah satu rekening berikut:
                        </p>
                        <div className="space-y-1 rounded border bg-background p-2 font-mono text-xs">
                          <div className="flex justify-between">
                            <span>BCA:</span>
                            <span className="font-semibold text-foreground">8012-3456-7890</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Mandiri:</span>
                            <span className="font-semibold text-foreground">137-00-1234567-8</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Atas Nama:</span>
                            <span className="font-semibold text-foreground">PT Vamios Solusi Edukasi</span>
                          </div>
                        </div>
                        <p>
                          Sertakan ID Pesanan{" "}
                          <span className="font-mono font-medium text-foreground">{orderDetail.data.id}</span> pada
                          berita transfer.
                        </p>
                      </div>
                    </div>

                    {orderDetail.data.paymentReference || orderDetail.data.proofUrl ? (
                      <div className="space-y-1 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
                        <p className="font-medium text-emerald-600 dark:text-emerald-400">
                          Bukti Transfer Telah Disimpan
                        </p>
                        {orderDetail.data.paymentReference ? (
                          <p className="text-muted-foreground">
                            No. Referensi:{" "}
                            <span className="font-mono text-foreground">{orderDetail.data.paymentReference}</span>
                          </p>
                        ) : null}
                        <p className="text-muted-foreground">
                          Penyelenggara akan memverifikasi mutasi bank Anda segera.
                        </p>
                      </div>
                    ) : (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          if (!selectedOrderId) return
                          submitProof.mutate({
                            orderId: selectedOrderId,
                            paymentReference: proofRef.trim(),
                            proofUrl: proofUrl.trim() || undefined,
                          })
                        }}
                        className="space-y-3 rounded-lg border p-3"
                      >
                        <p className="text-xs font-semibold">Konfirmasi Bukti Transfer</p>
                        <div className="space-y-1">
                          <Label htmlFor="learner-payment-ref" className="text-xs">
                            No. Referensi / Mutasi Transfer
                          </Label>
                          <Input
                            id="learner-payment-ref"
                            placeholder="Contoh: BCA-984214 / TRX-12345"
                            value={proofRef}
                            onChange={(e) => setProofRef(e.target.value)}
                            required
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="learner-proof-url" className="text-xs">
                            URL Bukti Transfer (Opsional)
                          </Label>
                          <Input
                            id="learner-proof-url"
                            type="url"
                            placeholder="https://..."
                            value={proofUrl}
                            onChange={(e) => setProofUrl(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <Button
                          size="sm"
                          type="submit"
                          disabled={submitProof.isPending || !proofRef.trim()}
                          className="w-full"
                        >
                          {submitProof.isPending ? "Mengirim..." : "Kirim Bukti Pembayaran"}
                        </Button>
                      </form>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}

      <Pager
        page={page}
        totalPages={orders.data?.pagination.totalPages ?? 1}
        disabled={orders.isFetching}
        onPageChange={setPage}
      />

      {checkoutUrl ? (
        <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium">Lanjutkan ke halaman pembayaran</p>
          <a href={checkoutUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
            {checkoutUrl}
          </a>
          <div>
            <Button size="sm" variant="outline" onClick={() => setCheckoutUrl(null)}>
              Tutup
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
