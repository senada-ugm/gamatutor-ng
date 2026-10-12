import { useParams } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { EmptyState } from "@/components/composed/_shared/empty-state"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { CheckInCard, CheckedInCard, NotOpenCard } from "@/components/composed/attendance/attendance-checkin-card"
import { AttendanceHistorySection, sameDay } from "@/components/composed/attendance/attendance-history-table"
import { apiGet } from "@/lib/api"
import type { ContractAttendanceRecord, ContractAttendanceSession } from "@workspace/contracts/domain"

const SESSION_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
}

export function AttendancePage() {
  const { courseId } = useParams({ from: "/learn/$courseId/attendance" })
  const sessions = useQuery({
    queryKey: ["attendance-sessions", courseId],
    queryFn: () => apiGet<ContractAttendanceSession[]>(`/courses/${courseId}/attendance-sessions?pageSize=100`),
  })
  const allSessions = sessions.data ?? []
  const todaySession = allSessions.find((s) => sameDay(new Date(s.sessionDate), new Date())) ?? null

  const myRecord = useQuery({
    queryKey: ["attendance-my-record", todaySession?.id],
    // 200 with data:null when the caller has no record yet
    queryFn: () => apiGet<ContractAttendanceRecord | null>(`/attendance-sessions/${todaySession?.id}/my-record`),
    enabled: todaySession != null,
  })

  if (sessions.isLoading) {
    return <Skeleton className="h-64 w-full" />
  }

  if (allSessions.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Presensi" />
        <EmptyState
          title="Belum ada sesi presensi"
          description="Instruktur belum menjadwalkan sesi presensi untuk pelatihan ini."
        />
      </div>
    )
  }

  const todayDateLabel = todaySession
    ? new Date(todaySession.sessionDate).toLocaleDateString("id-ID", SESSION_DATE_FORMAT)
    : new Date().toLocaleDateString("id-ID", SESSION_DATE_FORMAT)
  const record = myRecord.data ?? null

  return (
    <div className="space-y-6">
      <PageHeader title="Presensi" />

      {todaySession ? (
        record && record.status !== "absent" ? (
          <CheckedInCard session={todaySession} record={record} dateLabel={todayDateLabel} />
        ) : todaySession.sessionStatus !== "active" ? (
          <NotOpenCard dateLabel={todayDateLabel} />
        ) : (
          <CheckInCard session={todaySession} dateLabel={todayDateLabel} />
        )
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Presensi Hari Ini</CardTitle>
            <CardDescription>{todayDateLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription className="text-muted-foreground">
                Tidak ada sesi presensi yang dijadwalkan untuk hari ini.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      <AttendanceHistorySection sessions={allSessions} />
    </div>
  )
}
