import { useEffect, useState } from "react"
import { useParams } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import QRCode from "qrcode"
import { Maximize, Minimize } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { BackLink } from "@/components/composed/_shared/back-link"
import { EmptyState } from "@/components/composed/_shared/empty-state"
import { getSession } from "@/lib/auth"
import { apiGet } from "@/lib/api"
import type { ContractAttendanceSession } from "@workspace/contracts/domain"

/**
 * Standalone, chrome-less attendance display — meant to be opened in its
 * own tab/window and projected for the room, not viewed inside the
 * normal workspace shell. Mirrors ActiveChallenge's QR/code rendering in
 * attendance-manager.tsx (the compact in-panel version instructors see
 * while managing the roster), just full-screen and auto-refreshing so a
 * rotating code stays current without anyone touching the page.
 */
export function AttendanceDisplayPage() {
  const { sessionId } = useParams({ from: "/attendance-sessions/$sessionId/display" })
  const [authChecked, setAuthChecked] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void getSession().then((session) => {
      if (cancelled) return
      if (!session) {
        window.location.href = "/login"
        return
      }
      setAuthChecked(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const session = useQuery({
    queryKey: ["attendance-session", sessionId],
    queryFn: () => apiGet<ContractAttendanceSession>(`/attendance-sessions/${sessionId}`),
    enabled: authChecked,
    // The code/QR token rotates server-side — keep the projected display
    // current without anyone needing to touch this page.
    refetchInterval: 5000,
  })

  const s = session.data

  useEffect(() => {
    if (s?.verificationMethod === "qr" && s.qrToken) {
      void QRCode.toDataURL(s.qrToken, { width: 480, margin: 2 })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(null))
    } else {
      setQrDataUrl(null)
    }
  }, [s?.verificationMethod, s?.qrToken])

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement != null)
    }
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [])

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void document.documentElement.requestFullscreen()
    }
  }

  if (!authChecked || session.isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Skeleton className="size-64" />
      </div>
    )
  }

  if (!s) {
    return (
      <div className="flex min-h-svh flex-col gap-4 p-4">
        <BackLink to="/instructor" />
        <EmptyState title="Sesi presensi tidak ditemukan" className="mt-8" />
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between p-4">
        <BackLink to="/instructor" />
        <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
          {isFullscreen ? <Minimize /> : <Maximize />}
          {isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
        </Button>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-16 text-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{s.title}</h1>
          <p className="text-muted-foreground">Presensi</p>
        </div>

        {s.sessionStatus !== "active" ? (
          <p className="text-lg text-muted-foreground">Sesi belum diaktifkan.</p>
        ) : s.verificationMethod === "qr" ? (
          qrDataUrl ? (
            <img src={qrDataUrl} alt="QR check-in" className="size-[min(70vw,480px)]" />
          ) : (
            <p className="text-muted-foreground">Memuat QR…</p>
          )
        ) : s.verificationMethod === "code" && s.verificationCode ? (
          <p className="font-mono text-8xl font-bold tracking-widest">{s.verificationCode}</p>
        ) : (
          <p className="text-lg text-muted-foreground">Tanpa verifikasi — peserta dapat check-in langsung.</p>
        )}

        {s.sessionStatus === "active" ? (
          <>
            <Badge variant="secondary">Presensi dibuka</Badge>
            <p className="max-w-sm text-sm text-muted-foreground">
              Pindai atau masukkan kode ini dari halaman Presensi pada aplikasi peserta.
            </p>
          </>
        ) : null}
      </main>
    </div>
  )
}
