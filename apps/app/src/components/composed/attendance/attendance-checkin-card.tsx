import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import jsQR from "jsqr"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Toggle } from "@workspace/ui/components/toggle"

import { apiSend } from "@/lib/api"
import type { ContractAttendanceRecord, ContractAttendanceSession } from "@workspace/contracts/domain"

export function CheckedInCard({
  session,
  record,
  dateLabel,
}: {
  session: ContractAttendanceSession
  record: ContractAttendanceRecord
  dateLabel: string
}) {
  const label = { present: "Hadir", late: "Terlambat", excused: "Izin", absent: "Absen" }[record.status] ?? "Tercatat"
  return (
    <Card>
      <CardHeader>
        <CardTitle>{session.title}</CardTitle>
        <CardDescription>{dateLabel}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Alert>
          <AlertDescription className="font-medium">
            Anda sudah tercatat {label.toLowerCase()}.
            {record.checkedInAt
              ? ` pada ${new Date(record.checkedInAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
              : ""}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}

export function NotOpenCard({ dateLabel }: { dateLabel: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Presensi Hari Ini</CardTitle>
        <CardDescription>{dateLabel}</CardDescription>
      </CardHeader>
      <CardContent>
        <Alert>
          <AlertDescription className="text-muted-foreground">
            Presensi belum dibuka. Silakan tunggu instruktur mengaktifkan sesi.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}

export interface CheckInCardProps {
  session: ContractAttendanceSession
  dateLabel: string
}

export function CheckInCard({ session, dateLabel }: CheckInCardProps) {
  const queryClient = useQueryClient()
  const [verificationCode, setVerificationCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [inputMode, setInputMode] = useState<"manual" | "qr">("manual")
  const [isScanning, setIsScanning] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [checkedIn, setCheckedIn] = useState<ContractAttendanceRecord | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanFrameRef = useRef<number | null>(null)

  function stopScanner() {
    if (scanFrameRef.current) cancelAnimationFrame(scanFrameRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setIsScanning(false)
  }

  useEffect(() => stopScanner, [])

  async function startScanner() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setIsScanning(true)
      scanLoop()
    } catch {
      toast.error("Tidak dapat mengakses kamera", {
        description: "Izinkan akses kamera untuk memindai QR code.",
      })
    }
  }

  function scanLoop() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      scanFrameRef.current = requestAnimationFrame(scanLoop)
      return
    }
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height)
    if (code?.data) {
      stopScanner()
      void handleCheckIn({ qrToken: code.data })
      return
    }
    scanFrameRef.current = requestAnimationFrame(scanLoop)
  }

  async function getGeolocation(): Promise<{ latitude: number; longitude: number } | undefined> {
    if (session.latitude == null) return undefined
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
        })
      )
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }
    } catch {
      setError("Sesi ini memerlukan verifikasi lokasi. Izinkan akses lokasi untuk check-in.")
      return undefined
    }
  }

  async function handleCheckIn(challenge: { code?: string; qrToken?: string }) {
    setError(null)
    setIsSubmitting(true)

    const geo = await getGeolocation()
    if (session.latitude != null && !geo) {
      setIsSubmitting(false)
      return
    }

    try {
      const record = await apiSend<ContractAttendanceRecord>("POST", `/attendance-sessions/${session.id}/check-in`, {
        ...challenge,
        ...geo,
      })
      setCheckedIn(record)
      setVerificationCode("")
      toast.success("Berhasil check-in", {
        description: "Kehadiran Anda telah dicatat",
      })
      void queryClient.invalidateQueries({ queryKey: ["attendance-my-record", session.id] })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal check-in")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (checkedIn && checkedIn.status !== "absent") {
    return <CheckedInCard session={session} record={checkedIn} dateLabel={dateLabel} />
  }

  function switchMode(mode: "manual" | "qr") {
    if (mode === "manual") stopScanner()
    else setVerificationCode("")
    setInputMode(mode)
    setError(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{session.title}</CardTitle>
        <CardDescription>
          {dateLabel}
          {session.startTime || session.endTime ? ` · ${session.startTime ?? "-"}–${session.endTime ?? "-"}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Badge variant="secondary">Sesi aktif</Badge>

        {session.latitude != null ? (
          <p className="text-xs text-muted-foreground">
            Sesi ini memerlukan verifikasi lokasi (radius {session.radiusMeters} m).
          </p>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex gap-2">
          <Toggle
            pressed={inputMode === "manual"}
            onPressedChange={() => switchMode("manual")}
            size="sm"
            aria-label="Mode input manual"
          >
            Input Kode
          </Toggle>
          <Toggle
            pressed={inputMode === "qr"}
            onPressedChange={() => switchMode("qr")}
            size="sm"
            aria-label="Mode pindai QR"
          >
            Pindai QR
          </Toggle>
        </div>

        {inputMode === "manual" ? (
          <div className="flex max-w-sm gap-2">
            <Input
              placeholder="Masukkan 6-digit kode"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
              maxLength={6}
              disabled={isSubmitting}
            />
            <Button
              onClick={() => handleCheckIn({ code: verificationCode })}
              disabled={isSubmitting || verificationCode.trim().length === 0}
            >
              {isSubmitting ? "Memproses..." : "Check-In"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative aspect-video max-w-sm overflow-hidden rounded-lg bg-black">
              <video ref={videoRef} className="size-full object-cover" playsInline muted />
              <canvas ref={canvasRef} className="hidden" />
              {!isScanning ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Button onClick={() => void startScanner()} variant="secondary">
                    Buka Kamera
                  </Button>
                </div>
              ) : null}
            </div>
            {isScanning ? (
              <Button variant="outline" size="sm" onClick={stopScanner}>
                Tutup Kamera
              </Button>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
