import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { BarChart3, Clock, Download, Flame, Users } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"

import { EnrollmentStatusBadge } from "@/components/composed/_shared/enrollment-status-badge"
import { EmptyState } from "@/components/composed/_shared/empty-state"
import { API_URL, apiGet } from "@/lib/api"
import type { ContractCourseReport, ContractCourseTelemetrySummary } from "@workspace/contracts/domain"

const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]

/** "48 menit" / "1 jam 12 menit" — the report's study-time display form. */
function formatStudyDuration(seconds: number): string {
  if (seconds <= 0) return "0 menit"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} menit`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest > 0 ? `${hours} jam ${rest} menit` : `${hours} jam`
}

function heatColor(v: number, max: number): string {
  if (!v || !max) return "var(--muted)"
  const a = 0.15 + 0.85 * (v / max)
  return `rgba(19, 122, 119, ${a.toFixed(2)})`
}

export function CourseReportPanel({ courseId }: { courseId: string }) {
  const report = useQuery({
    queryKey: ["course-report", courseId],
    queryFn: () => apiGet<ContractCourseReport>(`/courses/${courseId}/report`),
  })

  // Real study-time aggregates (Review note #15) — same manager gate as
  // the report itself.
  const telemetry = useQuery({
    queryKey: ["course-telemetry", courseId],
    queryFn: () => apiGet<ContractCourseTelemetrySummary>(`/courses/${courseId}/telemetry-summary`),
  })

  // 7x24 dwell minutes, day-major Monday-first, from the 168-cell summary.
  const heatmapData = useMemo(() => {
    const cells = telemetry.data?.heatmapDwellSeconds
    if (!cells) return null
    return DAYS.map((_, dayIdx) =>
      Array.from({ length: 24 }, (__, hour) => Math.round((cells[dayIdx * 24 + hour] ?? 0) / 60))
    )
  }, [telemetry.data?.heatmapDwellSeconds])

  const heatMax = useMemo(() => (heatmapData ? Math.max(1, ...heatmapData.flat()) : 1), [heatmapData])

  const dailyActivity = useMemo(() => telemetry.data?.trend30d ?? null, [telemetry.data?.trend30d])
  const dailyMax = useMemo(
    () => (dailyActivity ? Math.max(1, ...dailyActivity.map((d) => d.activeLearners)) : 1),
    [dailyActivity]
  )

  const dwellByUser = useMemo(
    () => new Map((telemetry.data?.byParticipant ?? []).map((row) => [row.user.id, row])),
    [telemetry.data?.byParticipant]
  )

  if (report.isLoading) {
    return <Skeleton className="h-96 w-full" />
  }
  if (!report.data) {
    return <EmptyState title="Laporan tidak tersedia" />
  }

  const r = report.data
  const passedCount = r.participants.filter(
    (p) => p.enrollmentStatus === "graduated" || (p.finalGrade ?? 0) >= 70
  ).length
  const avgProgress = r.participants.length
    ? Math.round(r.participants.reduce((acc, p) => acc + p.progressPercent, 0) / r.participants.length)
    : 0

  return (
    <div className="space-y-8">
      {/* Header & Export Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">👁</span>
            <h2 className="text-xl font-bold tracking-tight text-[#173a5e] dark:text-foreground">
              Laporan Analisis & Waktu Belajar
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            {r.registrantCount} pendaftar · {r.participantCount} peserta diterima · {r.totalLessons} materi pelajaran
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            nativeButton={false}
            render={
              <a
                href={`${API_URL}/v1/courses/${courseId}/participants/export`}
                onClick={(e) => {
                  e.preventDefault()
                  window.open(`${API_URL}/v1/courses/${courseId}/participants/export`, "_blank")
                }}
              />
            }
          >
            <Download className="size-4" />
            Unduh CSV Peserta
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            nativeButton={false}
            render={
              <a
                href={`${API_URL}/v1/reports/telemetry/export?courseId=${courseId}`}
                onClick={(e) => {
                  e.preventDefault()
                  window.open(`${API_URL}/v1/reports/telemetry/export?courseId=${courseId}`, "_blank")
                }}
              />
            }
          >
            <Download className="size-4" />
            Unduh Telemetri Waktu Belajar (CSV)
          </Button>
        </div>
      </div>

      {/* Summary Metrics (Review Note #15) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="size-4 text-[#173a5e]" />
            <span>Pendaftar</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-[#173a5e] dark:text-foreground">{r.registrantCount}</div>
          <div className="text-[11px] text-muted-foreground">total akun mendaftar</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="size-4 text-[#2d77c2]" />
            <span>Peserta Aktif</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-[#2d77c2]">{r.participantCount}</div>
          <div className="text-[11px] text-muted-foreground">diterima di pelatihan</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BarChart3 className="size-4 text-emerald-600" />
            <span>Rerata Progres</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600">{avgProgress}%</div>
          <div className="text-[11px] text-muted-foreground">penyelesaian modul</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="size-4 text-amber-600" />
            <span>Lulus Evaluasi</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600">{passedCount}</div>
          <div className="text-[11px] text-muted-foreground">skor memenuhi syarat</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Flame className="size-4 text-[#137a77]" />
            <span>Median Waktu</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-[#137a77]">
            {telemetry.data ? formatStudyDuration(telemetry.data.medianParticipantDwellSeconds) : "…"}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {telemetry.data && telemetry.data.activeParticipants > 0
              ? `durasi belajar aktif · ${telemetry.data.activeParticipants} peserta tercatat`
              : "durasi belajar aktif"}
          </div>
        </Card>
      </div>

      {/* Kapan Peserta Belajar — Heatmap WIB (Review Note #15) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-[#173a5e] dark:text-foreground">
            Kapan Peserta Belajar (Heatmap Jam Akses WIB)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Menit belajar aktif per hari dan jam (WIB) dari seluruh dokter dan peserta. Makin gelap warna teal, makin
            tinggi interaksi.
          </p>
        </CardHeader>
        <CardContent>
          {heatmapData ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr>
                    <th className="p-1 text-left font-bold text-muted-foreground">Hari</th>
                    {Array.from({ length: 24 }, (_, h) => (
                      <th key={h} className="p-1 text-center font-mono text-[10px] text-muted-foreground">
                        {String(h).padStart(2, "0")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapData.map((row, dayIdx) => (
                    <tr key={dayIdx}>
                      <td className="p-1 font-semibold text-muted-foreground">{DAYS[dayIdx]}</td>
                      {row.map((val, hour) => {
                        const isDark = val / heatMax > 0.55
                        return (
                          <td
                            key={hour}
                            title={`${DAYS[dayIdx]} ${String(hour).padStart(2, "0")}:00 WIB — ${val} menit aktif`}
                            className="h-6 min-w-[22px] border border-white text-center font-mono text-[10px] dark:border-background"
                            style={{
                              backgroundColor: heatColor(val, heatMax),
                              color: isDark ? "#ffffff" : "var(--foreground)",
                            }}
                          >
                            {val > 0 ? val : ""}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              compact
              title="Belum ada data waktu belajar"
              description="Heatmap terisi setelah peserta mulai membuka materi pelatihan."
            />
          )}
        </CardContent>
      </Card>

      {/* Peserta Aktif Harian (30 Hari Terakhir) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-[#173a5e] dark:text-foreground">
            Peserta Aktif per Hari (30 Hari Terakhir)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Jumlah peserta unik yang mengakses materi dan berinteraksi setiap harinya.
          </p>
        </CardHeader>
        <CardContent>
          {dailyActivity ? (
            <>
              <div className="flex h-28 items-end gap-1 pt-4">
                {dailyActivity.map((d) => (
                  <div
                    key={d.date}
                    title={`${d.date}: ${d.activeLearners} peserta aktif`}
                    className="flex-1 rounded-t-sm bg-[#5bb4b2] transition-colors hover:bg-[#137a77]"
                    style={{ height: `${(d.activeLearners / dailyMax) * 100}%`, minHeight: "2px" }}
                  />
                ))}
              </div>
              <div className="flex justify-between pt-2 text-[11px] text-muted-foreground">
                <span>30 hari lalu</span>
                <span>Maksimal {dailyMax} peserta / hari</span>
                <span>Hari ini</span>
              </div>
            </>
          ) : (
            <EmptyState
              compact
              title="Belum ada data akses"
              description="Grafik terisi setelah peserta mulai membuka materi pelatihan."
            />
          )}
        </CardContent>
      </Card>

      {/* Tabel Rincian Peserta & Status Kelulusan */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-[#173a5e] dark:text-foreground">Daftar Kemajuan Peserta</h3>
        {r.participants.length === 0 ? (
          <EmptyState title="Belum ada peserta" description="Laporan terisi setelah peserta diterima di pelatihan." />
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Peserta & Kontak</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progres Materi</TableHead>
                  <TableHead>Waktu Belajar</TableHead>
                  <TableHead>Nilai Evaluasi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.participants.map((participant) => (
                  <TableRow key={participant.user.id}>
                    <TableCell>
                      <p className="font-semibold text-foreground">{participant.user.name}</p>
                      <p className="text-xs text-muted-foreground">{participant.user.email}</p>
                    </TableCell>
                    <TableCell>
                      <EnrollmentStatusBadge status={participant.enrollmentStatus} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{participant.progressPercent}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {dwellByUser.has(participant.user.id) ? (
                        formatStudyDuration(dwellByUser.get(participant.user.id)!.totalDwellSeconds)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {participant.finalGrade != null ? (
                        <span className="font-bold text-emerald-600">{participant.finalGrade}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
