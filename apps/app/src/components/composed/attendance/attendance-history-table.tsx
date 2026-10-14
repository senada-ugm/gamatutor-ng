import { useQuery } from "@tanstack/react-query"

import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"

import { apiGet } from "@/lib/api"
import type { ContractAttendanceRecord, ContractAttendanceSession } from "@workspace/contracts/domain"

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function AttendanceHistoryRow({ session }: { session: ContractAttendanceSession }) {
  const myRecord = useQuery({
    queryKey: ["attendance-my-record", session.id],
    queryFn: () => apiGet<ContractAttendanceRecord | null>(`/attendance-sessions/${session.id}/my-record`),
  })

  const sessionDate = new Date(session.sessionDate)
  const isPast = sessionDate.setHours(23, 59, 59, 999) < Date.now()
  const isToday = sameDay(new Date(session.sessionDate), new Date())

  const dateLabel = new Date(session.sessionDate).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })

  const timeLabel = session.startTime ? `${session.startTime}${session.endTime ? ` - ${session.endTime}` : ""}` : null

  const methodLabel =
    {
      none: "Otomatis",
      code: "Kode 6-Digit",
      qr: "Pindai QR",
    }[session.verificationMethod] ?? session.verificationMethod

  const record = myRecord.data

  let statusBadge: React.ReactNode

  if (myRecord.isLoading) {
    statusBadge = <Skeleton className="ml-auto h-5 w-16" />
  } else if (record && record.status !== "absent") {
    const label = { present: "Hadir", late: "Terlambat", excused: "Izin" }[record.status] ?? "Tercatat"
    const variant = record.status === "present" ? "default" : record.status === "late" ? "secondary" : "outline"
    statusBadge = (
      <Badge variant={variant} className="ml-auto">
        {label}
      </Badge>
    )
  } else if (session.sessionStatus === "completed" || (isPast && !isToday)) {
    statusBadge = (
      <Badge variant="destructive" className="ml-auto">
        Tidak Hadir
      </Badge>
    )
  } else if (session.sessionStatus === "active") {
    statusBadge = (
      <Badge variant="outline" className="ml-auto border-primary text-primary">
        Sedang Dibuka
      </Badge>
    )
  } else {
    statusBadge = (
      <Badge variant="outline" className="ml-auto text-muted-foreground">
        Belum Mulai
      </Badge>
    )
  }

  return (
    <TableRow>
      <TableCell className="font-medium">
        <div>{dateLabel}</div>
        {timeLabel ? <div className="text-xs text-muted-foreground">{timeLabel}</div> : null}
      </TableCell>
      <TableCell>
        <div className="font-medium text-foreground">{session.title}</div>
        {session.notes ? <div className="line-clamp-1 text-xs text-muted-foreground">{session.notes}</div> : null}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {methodLabel}
        {session.radiusMeters ? ` · Geofence ${session.radiusMeters}m` : ""}
      </TableCell>
      <TableCell className="text-right">{statusBadge}</TableCell>
    </TableRow>
  )
}

export function AttendanceHistorySection({ sessions }: { sessions: ContractAttendanceSession[] }) {
  const sorted = [...sessions].sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime())

  return (
    <Card>
      <CardHeader>
        <CardTitle>Riwayat Presensi</CardTitle>
        <CardDescription>Daftar seluruh sesi presensi untuk pelatihan ini.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Sesi</TableHead>
              <TableHead>Metode</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((session) => (
              <AttendanceHistoryRow key={session.id} session={session} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
