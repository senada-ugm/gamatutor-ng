import { Fragment, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
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

import { OrderStatusBadge } from "@/components/composed/payments/_atoms/order-status-badge"
import { EmptyState } from "@/components/composed/_shared/empty-state"
import { Pager } from "@/components/composed/_shared/pager"
import { apiGetPaged, apiSend } from "@/lib/api"
import { formatRupiah } from "@/lib/format"
import { formatCourseDate } from "@/lib/lms-date"
import type { ContractOrder } from "@workspace/contracts/domain"

/**
 * The course editor's Pembayaran tab — the manual-transfer order book:
 * every order for this course with confirm-receipt / cancel / refund
 * actions. Managers only (the editor itself is manager-gated).
 */

const PAGE_SIZE = 20

export function CoursePaymentsPanel({ courseId, coursePrice }: { courseId: string; coursePrice?: number | null }) {
  const queryClient = useQueryClient()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [confirmingOrder, setConfirmingOrder] = useState<ContractOrder | null>(null)
  const [paymentReference, setPaymentReference] = useState("")
  const [proofUrl, setProofUrl] = useState("")
  const [confirmationNote, setConfirmationNote] = useState("")

  const orders = useQuery({
    queryKey: ["orders", courseId, page],
    queryFn: () => apiGetPaged<ContractOrder>(`/orders?courseId=${courseId}&page=${page}&pageSize=${PAGE_SIZE}`),
  })

  const act = useMutation({
    mutationFn: async (input: { id: string; run: () => Promise<unknown>; successMessage: string }) => {
      setBusyId(input.id)
      try {
        await input.run()
        toast.success(input.successMessage)
        void queryClient.invalidateQueries({ queryKey: ["orders", courseId] })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Aksi gagal — coba lagi")
      } finally {
        setBusyId(null)
      }
    },
  })

  function openConfirmDialog(order: ContractOrder) {
    setConfirmingOrder(order)
    setPaymentReference("")
    setProofUrl("")
    setConfirmationNote("")
  }

  if ((coursePrice ?? 0) <= 0) {
    return (
      <EmptyState
        title="Pelatihan ini gratis"
        description="Pesanan pembayaran hanya muncul untuk pelatihan berbayar. Atur harga pelatihan di tab Detail untuk mengaktifkan pembayaran."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Pembayaran</h2>
        <p className="text-xs text-muted-foreground">
          Konfirmasi penerimaan transfer peserta di sini — materi terbuka otomatis setelah lunas.
        </p>
      </div>

      {orders.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (orders.data?.data ?? []).length === 0 ? (
        <EmptyState
          title="Belum ada pesanan"
          description="Belum ada peserta yang membuat pesanan untuk pelatihan ini."
        />
      ) : (
        <ItemGroup>
          {(orders.data?.data ?? []).map((order, index) => (
            <Fragment key={order.id}>
              {index > 0 ? <ItemSeparator /> : null}
              <Item>
                <ItemContent>
                  <ItemTitle>
                    <span className="font-mono text-xs text-muted-foreground">{order.id}</span>
                    <OrderStatusBadge status={order.status} />
                  </ItemTitle>
                  <ItemDescription className="line-clamp-2 text-xs">
                    <div>
                      {formatCourseDate(order.createdAt, { full: false })}
                      {order.couponCode ? ` · Kupon ${order.couponCode}` : ""}
                      {order.paidAt ? ` · Dibayar ${formatCourseDate(order.paidAt, { dateOnly: true })}` : ""}
                    </div>
                    {order.paymentReference || order.proofUrl || order.confirmationNotes ? (
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
                        {order.paymentReference ? (
                          <span>
                            Ref: <span className="font-mono text-foreground">{order.paymentReference}</span>
                          </span>
                        ) : null}
                        {order.proofUrl ? (
                          <a
                            href={order.proofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline hover:text-primary/80"
                          >
                            Bukti Transfer
                          </a>
                        ) : null}
                        {order.confirmationNotes ? <span>Catatan: {order.confirmationNotes}</span> : null}
                      </div>
                    ) : null}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <div className="text-right">
                    {order.discountAmount > 0 ? (
                      <p className="text-xs text-muted-foreground line-through">{formatRupiah(order.originalPrice)}</p>
                    ) : null}
                    <p className="text-sm font-bold">{formatRupiah(order.finalAmount)}</p>
                  </div>
                  {order.status === "pending" ? (
                    <>
                      <Button size="sm" disabled={busyId === order.id} onClick={() => openConfirmDialog(order)}>
                        Terima Pembayaran
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === order.id}
                        onClick={() =>
                          act.mutate({
                            id: order.id,
                            run: () => apiSend("POST", `/orders/${order.id}/cancel`),
                            successMessage: "Pesanan dibatalkan",
                          })
                        }
                      >
                        Batalkan
                      </Button>
                    </>
                  ) : null}
                  {order.status === "paid" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === order.id}
                      onClick={() =>
                        act.mutate({
                          id: order.id,
                          run: () =>
                            apiSend("POST", `/orders/${order.id}/refund`, {
                              reason: "Refund disetujui penyelenggara",
                            }),
                          successMessage: "Pesanan direfund",
                        })
                      }
                    >
                      Refund
                    </Button>
                  ) : null}
                </ItemActions>
              </Item>
            </Fragment>
          ))}
        </ItemGroup>
      )}

      <Pager
        page={page}
        totalPages={orders.data?.pagination.totalPages ?? 1}
        disabled={orders.isFetching}
        onPageChange={setPage}
      />

      <Dialog open={confirmingOrder !== null} onOpenChange={(open) => !open && setConfirmingOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Konfirmasi Pembayaran</DialogTitle>
            <DialogDescription>Verifikasi dana transfer peserta sebelum menyetujui pesanan ini.</DialogDescription>
          </DialogHeader>
          {confirmingOrder ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const orderToConfirm = confirmingOrder
                act.mutate({
                  id: orderToConfirm.id,
                  run: () =>
                    apiSend("POST", `/orders/${orderToConfirm.id}/confirm-payment`, {
                      paymentReference: paymentReference.trim() || undefined,
                      proofUrl: proofUrl.trim() || undefined,
                      note: confirmationNote.trim() || undefined,
                    }),
                  successMessage: "Pembayaran dikonfirmasi",
                })
                setConfirmingOrder(null)
              }}
              className="space-y-4"
            >
              <div className="space-y-1 rounded-lg bg-muted p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID Pesanan:</span>
                  <span className="font-mono">{confirmingOrder.id}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Total Tagihan:</span>
                  <span>{formatRupiah(confirmingOrder.finalAmount)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="payment-ref">No. Referensi / Mutasi Transfer</Label>
                <Input
                  id="payment-ref"
                  placeholder="Contoh: BCA-984214 / TRX-12345"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Nomor referensi atau mutasi bank untuk jejak audit rekonsiliasi.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proof-url">URL Bukti Transfer (Opsional)</Label>
                <Input
                  id="proof-url"
                  type="url"
                  placeholder="https://..."
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-note">Catatan Internal (Opsional)</Label>
                <Input
                  id="confirm-note"
                  placeholder="Contoh: Transfer via ATM BCA a.n. Budi"
                  value={confirmationNote}
                  onChange={(e) => setConfirmationNote(e.target.value)}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setConfirmingOrder(null)}>
                  Batal
                </Button>
                <Button type="submit" disabled={busyId === confirmingOrder.id}>
                  Konfirmasi Terima
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
