import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"

import { apiSend } from "@/lib/api"
import { formatRupiah } from "@/lib/format"
import type { ContractCourse, ContractEnrollment, ContractOrder } from "@workspace/contracts/domain"

/**
 * Lean port of legacy's EnrollButton state machine: the enrollment
 * funnel states driven by the real enrollment row, plus the paid-course
 * coupon -> order -> payment-instructions flow. Mock-only viewer states
 * (profile completeness, eligibility) have no real backend gate and are
 * omitted.
 */

interface CouponApplyResult {
  valid: boolean
  message?: string
  coupon?: { code: string; description?: string | null }
  pricing?: { originalPrice: number; discountAmount: number; finalPrice: number }
}

export function EnrollPanel({ course, enrollment }: { course: ContractCourse; enrollment: ContractEnrollment | null }) {
  const queryClient = useQueryClient()
  const isFree = !course.price || course.price <= 0
  const [busy, setBusy] = useState(false)
  const [showPaidConfirm, setShowPaidConfirm] = useState(false)
  const [couponCode, setCouponCode] = useState("")
  const [appliedCoupon, setAppliedCoupon] = useState<CouponApplyResult | null>(null)
  const [couponValidating, setCouponValidating] = useState(false)
  const [createdOrder, setCreatedOrder] = useState<ContractOrder | null>(null)

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["my-enrollment", course.id] })
    void queryClient.invalidateQueries({ queryKey: ["my-orders"] })
  }

  async function validateCoupon() {
    if (!couponCode.trim() || couponValidating) return
    setCouponValidating(true)
    try {
      const result = await apiSend<CouponApplyResult>("POST", "/coupons/validate", {
        courseId: course.id,
        code: couponCode.trim(),
      })
      setAppliedCoupon(result)
    } catch (err) {
      setAppliedCoupon({ valid: false, message: err instanceof Error ? err.message : "Gagal memeriksa kupon" })
    } finally {
      setCouponValidating(false)
    }
  }

  async function enroll() {
    setBusy(true)
    try {
      await apiSend<ContractEnrollment>("POST", "/enrollments", {
        courseId: course.id,
        enrollmentType: isFree ? "free" : "paid",
      })
      if (!isFree) {
        const order = await apiSend<ContractOrder>("POST", "/orders", {
          courseId: course.id,
          couponCode: appliedCoupon?.valid ? couponCode.trim() : undefined,
        })
        setShowPaidConfirm(false)
        setCouponCode("")
        setAppliedCoupon(null)
        if (order) {
          setCreatedOrder(order)
          invalidate()
          return
        }
        return
      }
      setShowPaidConfirm(false)
      toast.success("Berhasil mendaftar", { description: "Menunggu persetujuan penyelenggara." })
      invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mendaftar")
    } finally {
      setBusy(false)
    }
  }

  async function cancelEnrollment() {
    if (!enrollment) return
    setBusy(true)
    try {
      await apiSend<ContractEnrollment>("PATCH", `/enrollments/${enrollment.id}`, { status: "canceled" })
      toast.success("Pendaftaran dibatalkan")
      invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membatalkan pendaftaran")
    } finally {
      setBusy(false)
    }
  }

  const status = enrollment?.status
  const isRegisteredClosed = course.registrationCloseAt ? new Date(course.registrationCloseAt) < new Date() : false
  const isRegisteredNotOpen = course.registrationOpenAt ? new Date(course.registrationOpenAt) > new Date() : false
  const isFull = course.registrantQuota != null && course.registrantCount >= course.registrantQuota

  let body: React.ReactNode
  if (status === "graduated") {
    body = (
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button nativeButton={false} render={<Link to="/learn/$courseId" params={{ courseId: course.id }} />}>
          Pelajari Lagi
        </Button>
        {enrollment?.certificateId ? (
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <Link to="/certificates/$certificateId" params={{ certificateId: enrollment.certificateId } as never} />
            }
          >
            Lihat Sertifikat
          </Button>
        ) : null}
      </div>
    )
  } else if (status === "selected") {
    body = (
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">Anda terdaftar sebagai peserta.</p>
        <Button nativeButton={false} render={<Link to="/learn/$courseId" params={{ courseId: course.id }} />}>
          Lanjutkan Belajar
        </Button>
      </div>
    )
  } else if (status === "registered" || status === "interviewed") {
    body = (
      <div className="space-y-2">
        <Badge variant="secondary">Menunggu persetujuan</Badge>
        <p className="text-sm text-muted-foreground">Anda sudah terdaftar, menunggu disetujui sebagai peserta.</p>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void cancelEnrollment()}>
          Batal Daftar
        </Button>
      </div>
    )
  } else if (status === "canceled") {
    body = (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Pendaftaran Anda dibatalkan.</p>
        {!isRegisteredClosed && !isRegisteredNotOpen ? (
          <Button disabled={busy} onClick={() => (isFree ? void enroll() : setShowPaidConfirm(true))}>
            Daftar Kembali
          </Button>
        ) : null}
      </div>
    )
  } else if (status === "failed") {
    body = <p className="text-sm text-muted-foreground">Anda tidak lulus seleksi batch ini. Coba batch berikutnya.</p>
  } else if (isRegisteredClosed || isFull) {
    body = <Button disabled>{isFull ? "Kuota Penuh" : "Pendaftaran Ditutup"}</Button>
  } else if (isRegisteredNotOpen) {
    body = (
      <Button disabled variant="secondary">
        Pendaftaran Belum Dibuka
      </Button>
    )
  } else {
    body = (
      <Button disabled={busy} onClick={() => (isFree ? void enroll() : setShowPaidConfirm(true))}>
        {busy ? "Mendaftar..." : "Daftar"}
      </Button>
    )
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-4">
        {course.price ? (
          <div>
            <p className="text-xs text-muted-foreground">Biaya pelatihan</p>
            <p className="text-2xl font-semibold">{formatRupiah(course.price)}</p>
          </div>
        ) : (
          <Badge variant="secondary">Gratis</Badge>
        )}
        {body}

        {showPaidConfirm ? (
          <div className="w-full space-y-3 rounded-lg border p-3">
            <p className="text-sm font-medium">Konfirmasi Pendaftaran</p>
            <div className="flex gap-2">
              <Input
                id="coupon"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Kode kupon (opsional)"
                className="font-mono uppercase"
                disabled={appliedCoupon?.valid === true}
              />
              {appliedCoupon?.valid ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setAppliedCoupon(null)
                    setCouponCode("")
                  }}
                >
                  Hapus
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!couponCode.trim() || couponValidating}
                  onClick={() => void validateCoupon()}
                >
                  {couponValidating ? "Memeriksa..." : "Terapkan"}
                </Button>
              )}
            </div>
            {appliedCoupon?.valid && appliedCoupon.coupon ? (
              <p className="text-xs text-primary">
                Kupon &ldquo;{appliedCoupon.coupon.code}&rdquo; diterapkan
                {appliedCoupon.coupon.description ? ` — ${appliedCoupon.coupon.description}` : ""}.
              </p>
            ) : null}
            {appliedCoupon && !appliedCoupon.valid && appliedCoupon.message ? (
              <p className="text-xs text-destructive">{appliedCoupon.message}</p>
            ) : null}

            <div className="rounded-md bg-muted p-3 text-sm">
              {appliedCoupon?.valid && appliedCoupon.pricing ? (
                <>
                  <div className="flex items-center justify-between">
                    <span>Harga Normal</span>
                    <span className="line-through">{formatRupiah(appliedCoupon.pricing.originalPrice)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-primary">
                    <span>Diskon</span>
                    <span>-{formatRupiah(appliedCoupon.pricing.discountAmount)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t pt-2">
                    <span className="font-medium">Total Bayar</span>
                    <span className="text-lg font-bold text-primary">
                      {formatRupiah(appliedCoupon.pricing.finalPrice)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="font-medium">Total Bayar</span>
                  <span className="text-lg font-bold text-primary">{formatRupiah(course.price ?? 0)}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button disabled={busy} onClick={() => void enroll()}>
                {busy ? "Memproses..." : "Konfirmasi Pendaftaran"}
              </Button>
              <Button variant="outline" onClick={() => setShowPaidConfirm(false)}>
                Batal
              </Button>
            </div>
          </div>
        ) : null}

        {createdOrder ? (
          <div className="w-full space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-sm font-medium">Selesaikan Pembayaran</p>
            <p className="text-2xl font-bold text-primary">{formatRupiah(createdOrder.finalAmount)}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Transfer sesuai jumlah di atas ke rekening penyelenggara, lalu tunggu konfirmasi. Setelah lunas dan Anda
              disetujui sebagai peserta, materi pelatihan terbuka otomatis.
            </p>
            <div className="flex gap-2">
              <Button size="sm" nativeButton={false} render={<Link to="/orders" />}>
                Lihat Pesanan Saya
              </Button>
              <Button size="sm" variant="outline" onClick={() => setCreatedOrder(null)}>
                Tutup
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
