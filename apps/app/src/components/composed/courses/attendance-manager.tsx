import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import QRCode from "qrcode"
import { toast } from "sonner"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select"
import { Separator } from "@workspace/ui/components/separator"
import { EmptyState } from "@/components/composed/_shared/empty-state"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { apiGet, apiSend } from "@/lib/api"
import type {
  ContractAttendanceRecordStatus,
  ContractAttendanceSession,
  ContractAttendanceVerificationMethod,
  ContractEnrolledStudentAttendance,
} from "@workspace/contracts/domain"

/**
 * Presensi tab (instructor side): schedule sessions, activate them with
 * a rotating code/QR challenge (optionally geofenced), and work the
 * roster — manual status marks for students who can't check in
 * themselves. The student-side check-in lives in the player.
 */

const SESSION_BADGES = {
  pending: { label: "Menunggu", variant: "secondary" as const },
  active: { label: "Aktif", variant: "default" as const },
  completed: { label: "Selesai", variant: "outline" as const },
  cancelled: { label: "Dibatalkan", variant: "outline" as const },
  holiday: { label: "Libur", variant: "outline" as const },
}

const RECORD_LABELS: Record<ContractAttendanceRecordStatus, string> = {
  present: "Hadir",
  late: "Terlambat",
  absent: "Absen",
  excused: "Izin",
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
}

export function AttendanceManager({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const sessions = useQuery({
    queryKey: ["attendance-sessions", courseId],
    queryFn: () => apiGet<ContractAttendanceSession[]>(`/courses/${courseId}/attendance-sessions?pageSize=100`),
  })

  const createSession = useMutation({
    mutationFn: (values: SessionFormValues) =>
      apiSend<ContractAttendanceSession>("POST", `/courses/${courseId}/attendance-sessions`, {
        title: values.title,
        sessionDate: new Date(values.sessionDate).toISOString(),
        startTime: values.startTime || undefined,
        endTime: values.endTime || undefined,
        lateThresholdMinutes: values.lateThresholdMinutes ? Number(values.lateThresholdMinutes) : undefined,
      }),
    onSuccess: () => {
      toast.success("Sesi dibuat")
      setShowCreate(false)
      void queryClient.invalidateQueries({ queryKey: ["attendance-sessions", courseId] })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal membuat sesi"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Presensi</h2>
        <Button onClick={() => setShowCreate((v) => !v)}>Sesi Baru</Button>
      </div>

      {showCreate ? (
        <SessionForm
          submitting={createSession.isPending}
          onSubmit={(values) => createSession.mutate(values)}
          onCancel={() => setShowCreate(false)}
        />
      ) : null}

      {sessions.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (sessions.data ?? []).length === 0 ? (
        <EmptyState title="Belum ada sesi presensi" description="Buat sesi untuk jadwal pertemuan berikutnya." />
      ) : (
        <div className="space-y-3">
          {(sessions.data ?? []).map((session) => {
            const badge = SESSION_BADGES[session.sessionStatus] ?? SESSION_BADGES.pending
            const isExpanded = expandedId === session.id
            return (
              <Card key={session.id}>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-medium">{session.title}</h3>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(session.sessionDate).toLocaleDateString("id-ID", DATE_FORMAT)}
                        {session.startTime || session.endTime
                          ? ` · ${session.startTime ?? "-"}–${session.endTime ?? "-"}`
                          : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => setExpandedId(isExpanded ? null : session.id)}
                    >
                      {isExpanded ? "Tutup" : "Kelola"}
                    </Button>
                  </div>

                  {isExpanded ? <SessionDetail courseId={courseId} session={session} /> : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// --- Session create form ------------------------------------------------------

interface SessionFormValues {
  title: string
  sessionDate: string
  startTime: string
  endTime: string
  lateThresholdMinutes: string
}

function SessionForm({
  submitting,
  onSubmit,
  onCancel,
}: {
  submitting: boolean
  onSubmit: (values: SessionFormValues) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState<SessionFormValues>({
    title: "",
    sessionDate: "",
    startTime: "",
    endTime: "",
    lateThresholdMinutes: "15",
  })

  function update<TKey extends keyof SessionFormValues>(key: TKey, value: SessionFormValues[TKey]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.title.trim() || !values.sessionDate) {
      toast.error("Judul dan tanggal sesi wajib diisi")
      return
    }
    onSubmit(values)
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="session-title">Judul Sesi</Label>
            <Input
              id="session-title"
              value={values.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="cth: Pertemuan 1 — Pengantar"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="session-date">Tanggal & Waktu</Label>
              <Input
                id="session-date"
                type="datetime-local"
                value={values.sessionDate}
                onChange={(e) => update("sessionDate", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-late">Toleransi Keterlambatan (menit)</Label>
              <Input
                id="session-late"
                type="number"
                min={0}
                value={values.lateThresholdMinutes}
                onChange={(e) => update("lateThresholdMinutes", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-start">Jam Mulai (opsional)</Label>
              <Input
                id="session-start"
                type="time"
                value={values.startTime}
                onChange={(e) => update("startTime", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-end">Jam Selesai (opsional)</Label>
              <Input
                id="session-end"
                type="time"
                value={values.endTime}
                onChange={(e) => update("endTime", e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Menyimpan..." : "Buat Sesi"}
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

// --- Expanded session: activate / challenge / roster --------------------------

function SessionDetail({ courseId, session }: { courseId: string; session: ContractAttendanceSession }) {
  const queryClient = useQueryClient()
  const [method, setMethod] = useState<ContractAttendanceVerificationMethod>(
    session.verificationMethod === "none" ? "code" : session.verificationMethod
  )
  const [useGeofence, setUseGeofence] = useState(session.latitude != null)
  const [latitude, setLatitude] = useState(session.latitude != null ? String(session.latitude) : "")
  const [longitude, setLongitude] = useState(session.longitude != null ? String(session.longitude) : "")
  const [radius, setRadius] = useState(session.radiusMeters != null ? String(session.radiusMeters) : "100")

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["attendance-sessions", courseId] })
    void queryClient.invalidateQueries({ queryKey: ["attendance-roster", session.id] })
  }

  const activate = useMutation({
    mutationFn: () =>
      apiSend<ContractAttendanceSession>("POST", `/attendance-sessions/${session.id}/activate`, {
        verificationMethod: method,
        ...(useGeofence && latitude && longitude
          ? { latitude: Number(latitude), longitude: Number(longitude), radiusMeters: Number(radius) || 100 }
          : {}),
      }),
    onSuccess: () => {
      toast.success("Sesi diaktifkan")
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal mengaktifkan sesi"),
  })

  const complete = useMutation({
    mutationFn: () =>
      apiSend<ContractAttendanceSession>("PATCH", `/attendance-sessions/${session.id}`, {
        sessionStatus: "completed",
      }),
    onSuccess: () => {
      toast.success("Sesi ditandai selesai")
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal memperbarui sesi"),
  })

  const mark = useMutation({
    mutationFn: (input: { userId: string; status: ContractAttendanceRecordStatus }) =>
      apiSend<unknown>("PATCH", `/attendance-sessions/${session.id}/records/${input.userId}`, {
        status: input.status,
      }),
    onSuccess: () => invalidate(),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menandai kehadiran"),
  })

  const roster = useQuery({
    queryKey: ["attendance-roster", session.id],
    queryFn: () => apiGet<ContractEnrolledStudentAttendance[]>(`/attendance-sessions/${session.id}/roster`),
  })

  return (
    <>
      <Separator />
      {session.sessionStatus === "active" ? (
        <ActiveChallenge session={session} onComplete={() => complete.mutate()} completing={complete.isPending} />
      ) : (
        <ActivateControls
          method={method}
          setMethod={setMethod}
          useGeofence={useGeofence}
          setUseGeofence={setUseGeofence}
          latitude={latitude}
          setLatitude={setLatitude}
          longitude={longitude}
          setLongitude={setLongitude}
          radius={radius}
          setRadius={setRadius}
          activating={activate.isPending}
          onActivate={() => activate.mutate()}
        />
      )}

      <Separator />

      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Daftar Hadir</h4>
        {roster.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (roster.data ?? []).length === 0 ? (
          <EmptyState
            compact
            title="Belum ada peserta"
            description="Peserta yang diterima akan muncul di daftar hadir."
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border">
            {(roster.data ?? []).map((row) => (
              <li key={row.user.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.user.name || row.user.email}</p>
                  {row.record ? (
                    <p className="text-xs text-muted-foreground">
                      {RECORD_LABELS[row.record.status]}
                      {row.record.checkedInAt
                        ? ` · ${new Date(row.record.checkedInAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
                        : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Belum check-in</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  {(["present", "late", "excused", "absent"] as const).map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={row.record?.status === status ? "default" : "outline"}
                      disabled={mark.isPending}
                      onClick={() => mark.mutate({ userId: row.user.id, status })}
                    >
                      {RECORD_LABELS[status]}
                    </Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function ActivateControls({
  method,
  setMethod,
  useGeofence,
  setUseGeofence,
  latitude,
  setLatitude,
  longitude,
  setLongitude,
  radius,
  setRadius,
  activating,
  onActivate,
}: {
  method: ContractAttendanceVerificationMethod
  setMethod: (m: ContractAttendanceVerificationMethod) => void
  useGeofence: boolean
  setUseGeofence: (v: boolean) => void
  latitude: string
  setLatitude: (v: string) => void
  longitude: string
  setLongitude: (v: string) => void
  radius: string
  setRadius: (v: string) => void
  activating: boolean
  onActivate: () => void
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="activate-method">Metode Verifikasi</Label>
          <NativeSelect
            id="activate-method"
            className="w-full"
            value={method}
            onChange={(e) => setMethod(e.target.value as ContractAttendanceVerificationMethod)}
          >
            <NativeSelectOption value="code">Kode Manual</NativeSelectOption>
            <NativeSelectOption value="qr">QR Code</NativeSelectOption>
            <NativeSelectOption value="none">Tanpa Verifikasi</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="flex items-end">
          <p className="text-xs text-muted-foreground">
            Mengaktifkan sesi menghasilkan kode/token baru dan menghitung ulang masa berlakunya.
          </p>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={useGeofence} onCheckedChange={(c) => setUseGeofence(c === true)} />
        Batasi dengan lokasi (geofence)
      </label>
      {useGeofence ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="geo-lat">Latitude</Label>
            <Input
              id="geo-lat"
              type="number"
              step="any"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="geo-lng">Longitude</Label>
            <Input
              id="geo-lng"
              type="number"
              step="any"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="geo-radius">Radius (meter)</Label>
            <Input id="geo-radius" type="number" min={1} value={radius} onChange={(e) => setRadius(e.target.value)} />
          </div>
        </div>
      ) : null}

      <Button onClick={onActivate} disabled={activating}>
        {activating ? "Mengaktifkan..." : "Aktifkan Sesi"}
      </Button>
    </div>
  )
}

function ActiveChallenge({
  session,
  onComplete,
  completing,
}: {
  session: ContractAttendanceSession
  onComplete: () => void
  completing: boolean
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (session.verificationMethod === "qr" && session.qrToken) {
      void QRCode.toDataURL(session.qrToken, { width: 240, margin: 2 })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(null))
    } else {
      setQrDataUrl(null)
    }
  }, [session.verificationMethod, session.qrToken])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Badge>Presensi dibuka</Badge>
        {session.verificationMethod !== "none" ? (
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<a href={`/attendance-sessions/${session.id}/display`} target="_blank" rel="noreferrer" />}
          >
            Buka Tampilan Presensi
          </Button>
        ) : null}
      </div>
      {session.verificationMethod === "code" && session.verificationCode ? (
        <div className="rounded-lg border bg-muted/40 p-4 text-center">
          <p className="text-xs text-muted-foreground">Kode check-in saat ini</p>
          <p className="font-mono text-3xl font-bold tracking-widest">{session.verificationCode}</p>
          {session.codeExpirySeconds ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Berlaku {session.codeExpirySeconds} detik sebelum diganti
            </p>
          ) : null}
        </div>
      ) : null}
      {session.verificationMethod === "qr" ? (
        qrDataUrl ? (
          <div className="flex flex-col items-center rounded-lg border bg-muted/40 p-4">
            <img src={qrDataUrl} alt="QR check-in" className="size-48" />
            <p className="mt-2 text-xs text-muted-foreground">
              Peserta memindai QR ini dari halaman Presensi di pelatihan.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Memuat QR…</p>
        )
      ) : null}
      {session.verificationMethod === "none" ? (
        <p className="text-sm text-muted-foreground">
          Tanpa verifikasi — peserta dapat check-in langsung selama sesi aktif.
        </p>
      ) : null}
      <Button variant="outline" onClick={onComplete} disabled={completing}>
        {completing ? "Menyimpan..." : "Tutup Sesi"}
      </Button>
    </div>
  )
}
