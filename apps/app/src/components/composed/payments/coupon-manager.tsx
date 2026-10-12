import { Fragment, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { EmptyState } from "@/components/composed/_shared/empty-state"
import { useConfirm } from "@/components/composed/_shared/confirm-dialog"
import { apiGet, apiSend } from "@/lib/api"
import { formatRupiah } from "@/lib/format"
import { formatCourseDate } from "@/lib/lms-date"
import type { ContractCoupon } from "@workspace/contracts/domain"

/**
 * The course editor's Kupon tab: discount coupons scoped to this course
 * (or platform-wide when created without one — this surface always
 * scopes). Deactivating keeps redemption history intact.
 */

export function CouponManager({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [showCreate, setShowCreate] = useState(false)
  const [selectedCouponId, setSelectedCouponId] = useState<string | null>(null)

  const coupons = useQuery({
    queryKey: ["coupons", courseId],
    queryFn: () => apiGet<ContractCoupon[]>(`/coupons?courseId=${courseId}&pageSize=100`),
  })

  const couponDetail = useQuery({
    queryKey: ["coupon-detail", selectedCouponId],
    queryFn: () => apiGet<ContractCoupon>(`/coupons/${selectedCouponId}`),
    enabled: selectedCouponId !== null,
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["coupons", courseId] })
  }

  const create = useMutation({
    mutationFn: (values: CouponFormValues) =>
      apiSend<ContractCoupon>("POST", "/coupons", {
        code: values.code.toUpperCase(),
        description: values.description || undefined,
        discountType: values.discountType,
        discountValue: Number(values.discountValue),
        maxDiscountAmount: values.maxDiscountAmount ? Number(values.maxDiscountAmount) : undefined,
        courseId,
        maxUsesPerUser: Number(values.maxUsesPerUser) || 1,
      }),
    onSuccess: () => {
      toast.success("Kupon dibuat")
      setShowCreate(false)
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal membuat kupon"),
  })

  const update = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      apiSend<ContractCoupon>("PATCH", `/coupons/${input.id}`, {
        isActive: input.isActive,
      }),
    onSuccess: (_data, input) => {
      toast.success(input.isActive ? "Kupon diaktifkan" : "Kupon dinonaktifkan")
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal memperbarui kupon"),
  })

  const remove = useMutation({
    mutationFn: (id: string) => apiSend<null>("DELETE", `/coupons/${id}`),
    onSuccess: () => {
      toast.success("Kupon dihapus")
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menghapus kupon"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Kupon</h2>
        <Button onClick={() => setShowCreate((v) => !v)}>Kupon Baru</Button>
      </div>

      {showCreate ? (
        <CouponForm
          submitting={create.isPending}
          onSubmit={(values) => create.mutate(values)}
          onCancel={() => setShowCreate(false)}
        />
      ) : null}

      {coupons.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (coupons.data ?? []).length === 0 ? (
        <EmptyState title="Belum ada kupon" description="Buat kode diskon untuk peserta pelatihan ini." />
      ) : (
        <ItemGroup>
          {(coupons.data ?? []).map((coupon, index) => (
            <Fragment key={coupon.id}>
              {index > 0 ? <ItemSeparator /> : null}
              <Item>
                <ItemContent>
                  <ItemTitle>
                    <span className="font-mono">{coupon.code}</span>
                    <Badge variant={coupon.isActive ? "default" : "outline"}>
                      {coupon.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </ItemTitle>
                  <ItemDescription className="line-clamp-1 text-xs">
                    {coupon.discountType === "percentage"
                      ? `Diskon ${coupon.discountValue}%${coupon.maxDiscountAmount ? ` (maks ${formatRupiah(coupon.maxDiscountAmount)})` : ""}`
                      : `Diskon ${formatRupiah(coupon.discountValue)}`}
                    {" · "}
                    {coupon.stats?.totalUses ?? 0}x dipakai
                    {coupon.expiresAt ? ` · berakhir ${formatCourseDate(coupon.expiresAt, { full: false })}` : ""}
                  </ItemDescription>
                  {coupon.description ? (
                    <ItemDescription className="line-clamp-1 text-xs">{coupon.description}</ItemDescription>
                  ) : null}
                </ItemContent>
                <ItemActions>
                  <Button size="sm" variant="outline" onClick={() => setSelectedCouponId(coupon.id)}>
                    Detail
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate({
                        id: coupon.id,
                        isActive: !coupon.isActive,
                      })
                    }
                  >
                    {coupon.isActive ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={remove.isPending}
                    onClick={() => {
                      void confirm({
                        title: "Hapus kupon?",
                        description: `Kode ${coupon.code} tidak bisa dipakai lagi setelah dihapus.`,
                        confirmLabel: "Hapus",
                        destructive: true,
                      }).then((ok) => {
                        if (ok) remove.mutate(coupon.id)
                      })
                    }}
                  >
                    Hapus
                  </Button>
                </ItemActions>
              </Item>
            </Fragment>
          ))}
        </ItemGroup>
      )}

      {selectedCouponId ? (
        <Dialog open={selectedCouponId !== null} onOpenChange={(open) => !open && setSelectedCouponId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detail Kupon</DialogTitle>
              <DialogDescription>Rincian batas pemakaian dan ketentuan kupon diskon.</DialogDescription>
            </DialogHeader>
            {couponDetail.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : couponDetail.data ? (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-muted-foreground">Kode Kupon</span>
                    <p className="font-mono font-medium">{couponDetail.data.code}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Status</span>
                    <p>
                      <Badge variant={couponDetail.data.isActive ? "default" : "outline"}>
                        {couponDetail.data.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Tipe Diskon</span>
                    <p className="capitalize">{couponDetail.data.discountType}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Nilai Diskon</span>
                    <p className="font-semibold">
                      {couponDetail.data.discountType === "percentage"
                        ? `${couponDetail.data.discountValue}%`
                        : formatRupiah(couponDetail.data.discountValue)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Total Pemakaian</span>
                    <p>{couponDetail.data.stats?.totalUses ?? 0} kali</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Maks. per Pengguna</span>
                    <p>{couponDetail.data.maxUsesPerUser ?? 1} kali</p>
                  </div>
                </div>
                {couponDetail.data.description ? (
                  <div>
                    <span className="text-xs text-muted-foreground">Deskripsi</span>
                    <p className="text-muted-foreground">{couponDetail.data.description}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}

interface CouponFormValues {
  code: string
  description: string
  discountType: "percentage" | "fixed"
  discountValue: string
  maxDiscountAmount: string
  maxUsesPerUser: string
}

function CouponForm({
  submitting,
  onSubmit,
  onCancel,
}: {
  submitting: boolean
  onSubmit: (values: CouponFormValues) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState<CouponFormValues>({
    code: "",
    description: "",
    discountType: "percentage",
    discountValue: "10",
    maxDiscountAmount: "",
    maxUsesPerUser: "1",
  })

  function update<TKey extends keyof CouponFormValues>(key: TKey, value: CouponFormValues[TKey]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.code.trim()) {
      toast.error("Kode kupon wajib diisi")
      return
    }
    const amount = Number(values.discountValue)
    if (!amount || amount <= 0) {
      toast.error("Nilai diskon harus lebih dari 0")
      return
    }
    if (values.discountType === "percentage" && amount > 100) {
      toast.error("Diskon persentase maksimal 100%")
      return
    }
    onSubmit(values)
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="coupon-code">Kode</Label>
              <Input
                id="coupon-code"
                value={values.code}
                onChange={(e) => update("code", e.target.value.toUpperCase())}
                placeholder="DISKON20"
                className="font-mono uppercase"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coupon-type">Jenis Diskon</Label>
              <NativeSelect
                id="coupon-type"
                className="w-full"
                value={values.discountType}
                onChange={(e) => update("discountType", e.target.value as CouponFormValues["discountType"])}
              >
                <NativeSelectOption value="percentage">Persentase (%)</NativeSelectOption>
                <NativeSelectOption value="fixed">Nominal (Rupiah)</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coupon-value">
                {values.discountType === "percentage" ? "Diskon (%)" : "Diskon (Rupiah)"}
              </Label>
              <Input
                id="coupon-value"
                type="number"
                min={1}
                max={values.discountType === "percentage" ? 100 : undefined}
                value={values.discountValue}
                onChange={(e) => update("discountValue", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coupon-maxuses">Maks. Pakai per Peserta</Label>
              <Input
                id="coupon-maxuses"
                type="number"
                min={1}
                value={values.maxUsesPerUser}
                onChange={(e) => update("maxUsesPerUser", e.target.value)}
              />
            </div>
            {values.discountType === "percentage" ? (
              <div className="space-y-1.5">
                <Label htmlFor="coupon-maxamount">Maks. Diskon (Rupiah, opsional)</Label>
                <Input
                  id="coupon-maxamount"
                  type="number"
                  min={0}
                  value={values.maxDiscountAmount}
                  onChange={(e) => update("maxDiscountAmount", e.target.value)}
                  placeholder="tanpa batas"
                />
              </div>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coupon-description">Deskripsi (opsional)</Label>
            <Input
              id="coupon-description"
              value={values.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Menyimpan..." : "Buat Kupon"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Batal
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
