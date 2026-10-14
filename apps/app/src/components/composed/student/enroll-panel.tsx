import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"

import { apiSend } from "@/lib/api"
import type { ContractCourse, ContractEnrollment } from "@workspace/contracts/domain"

/**
 * Lean port of legacy's EnrollButton state machine: the enrollment
 * funnel states driven by the real enrollment row. DRIVE-Learn training
 * is free — enrollment is a single POST with no checkout step (the
 * coupon -> order -> payment-instructions flow was removed with the
 * payments domain; see docs/PLANS.md Phase 1).
 */

export function EnrollPanel({ course, enrollment }: { course: ContractCourse; enrollment: ContractEnrollment | null }) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["my-enrollment", course.id] })
  }

  async function enroll() {
    setBusy(true)
    try {
      await apiSend<ContractEnrollment>("POST", "/enrollments", {
        courseId: course.id,
        enrollmentType: "free",
      })
      toast.success("Enrolled successfully", { description: "Awaiting organizer approval." })
      invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to enroll")
    } finally {
      setBusy(false)
    }
  }

  async function cancelEnrollment() {
    if (!enrollment) return
    setBusy(true)
    try {
      await apiSend<ContractEnrollment>("PATCH", `/enrollments/${enrollment.id}`, { status: "canceled" })
      toast.success("Enrollment cancelled")
      invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel")
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
          Review Course
        </Button>
        {enrollment?.certificateId ? (
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <Link to="/certificates/$certificateId" params={{ certificateId: enrollment.certificateId } as never} />
            }
          >
            View Certificate
          </Button>
        ) : null}
      </div>
    )
  } else if (status === "selected") {
    body = (
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">You are enrolled as an active participant.</p>
        <Button nativeButton={false} render={<Link to="/learn/$courseId" params={{ courseId: course.id }} />}>
          Continue Learning
        </Button>
      </div>
    )
  } else if (status === "registered" || status === "interviewed") {
    body = (
      <div className="space-y-2">
        <Badge variant="secondary">Menunggu persetujuan</Badge>
        <p className="text-sm text-muted-foreground">Anda sudah terdaftar, menunggu disetujui sebagai peserta.</p>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void cancelEnrollment()}>
          Batalkan Pendaftaran
        </Button>
      </div>
    )
  } else if (status === "canceled") {
    body = (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Pendaftaran Anda dibatalkan.</p>
        {!isRegisteredClosed && !isRegisteredNotOpen ? (
          <Button disabled={busy} onClick={() => void enroll()}>
            Daftar Ulang
          </Button>
        ) : null}
      </div>
    )
  } else if (status === "failed") {
    body = (
      <p className="text-sm text-muted-foreground">
        Anda belum terpilih untuk angkatan ini. Silakan mendaftar pada angkatan berikutnya.
      </p>
    )
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
      <Button disabled={busy} onClick={() => void enroll()}>
        {busy ? "Mendaftar…" : "Daftar"}
      </Button>
    )
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-4">
        <Badge variant="secondary">Gratis</Badge>
        {body}
      </CardContent>
    </Card>
  )
}
