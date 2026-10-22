import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { AlertCircle, Award, BookOpen, ChevronRight, Trash2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { ENROLLMENT_STATUS, EnrollmentStatusBadge } from "@/components/composed/_shared/enrollment-status-badge"
import { EmptyState } from "@/components/composed/_shared/empty-state"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { Pager } from "@/components/composed/_shared/pager"
import { useConfirm } from "@/components/composed/_shared/confirm-dialog"

import { apiGet, apiGetPaged, apiSend } from "@/lib/api"
import { formatCourseDate } from "@/lib/lms-date"
import type {
  ContractEnrollment,
  ContractEnrollmentStatus,
  ContractParticipantProfile,
} from "@workspace/contracts/domain"

/**
 * Peserta tab: clickable roster with chevron indicators and a comprehensive
 * detail modal housing all workflow transitions (accept, graduate, reject, cancel, expel).
 */
export function ParticipantsPanel({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 20

  const enrollments = useQuery({
    queryKey: ["enrollments", courseId, page],
    queryFn: () =>
      apiGetPaged<ContractEnrollment>(`/enrollments?courseId=${courseId}&page=${page}&pageSize=${pageSize}`),
  })

  const enrollmentDetail = useQuery({
    queryKey: ["enrollment-detail", selectedEnrollmentId],
    queryFn: () => apiGet<ContractEnrollment>(`/enrollments/${selectedEnrollmentId}`),
    enabled: selectedEnrollmentId !== null,
  })

  const rows = enrollments.data?.data ?? []
  const totalCount = enrollments.data?.pagination.totalCount ?? 0
  const totalPages = enrollments.data?.pagination.totalPages ?? 1

  const userIds = [...new Set(rows.map((e) => e.userId))]
  const profiles = useQuery({
    queryKey: ["participant-profiles", courseId, userIds.join(",")],
    queryFn: async () => {
      const profileRows = await apiGet<ContractParticipantProfile[]>(
        `/participant-profiles?userIds=${encodeURIComponent(userIds.join(","))}`
      )
      return new Map(profileRows.map((row) => [row.id, row]))
    },
    enabled: userIds.length > 0,
  })

  const issueCertificate = useMutation({
    mutationFn: (enrollmentId: string) =>
      apiSend<unknown>("POST", `/courses/${courseId}/certificates`, {
        enrollmentId,
      }),
    onSuccess: () => {
      toast.success("Sertifikat diterbitkan")
      void queryClient.invalidateQueries({
        queryKey: ["enrollments", courseId],
      })
      void queryClient.invalidateQueries({
        queryKey: ["enrollment-detail", selectedEnrollmentId],
      })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menerbitkan sertifikat"),
  })

  const updateStatus = useMutation({
    mutationFn: (input: { id: string; status: ContractEnrollmentStatus }) =>
      apiSend<ContractEnrollment>("PATCH", `/enrollments/${input.id}`, {
        status: input.status,
      }),
    onSuccess: (_data, input) => {
      toast.success(`Status peserta diubah ke ${ENROLLMENT_STATUS[input.status].label.toLowerCase()}`)
      void queryClient.invalidateQueries({
        queryKey: ["enrollments", courseId],
      })
      void queryClient.invalidateQueries({
        queryKey: ["enrollment-detail", input.id],
      })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal mengubah status"),
  })

  const removeEnrollment = useMutation({
    mutationFn: (id: string) => apiSend<null>("DELETE", `/enrollments/${id}`),
    onSuccess: () => {
      toast.success("Peserta dikeluarkan dari pelatihan")
      setSelectedEnrollmentId(null)
      void queryClient.invalidateQueries({
        queryKey: ["enrollments", courseId],
      })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal mengeluarkan peserta"),
  })

  const selectedEnrollment = enrollmentDetail.data ?? rows.find((e) => e.id === selectedEnrollmentId)
  const selectedProfile = selectedEnrollment ? profiles.data?.get(selectedEnrollment.userId) : undefined

  if (enrollments.isLoading || enrollments.isError || rows.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-medium">Peserta</h2>
        {enrollments.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : enrollments.isError ? (
          <ErrorState error={enrollments.error} onRetry={() => void enrollments.refetch()} />
        ) : (
          <EmptyState title="Belum ada pendaftar" description="Peserta terdaftar akan muncul di sini." />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Peserta</h2>
          <p className="text-xs text-muted-foreground">
            Klik baris peserta untuk melihat detail dan mengelola status pendaftaran.
          </p>
        </div>
        <p className="text-sm font-medium text-muted-foreground">{totalCount} pendaftar</p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[38%]">Peserta</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Terdaftar</TableHead>
              <TableHead className="hidden md:table-cell">Progres</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((enrollment) => {
              const profile = profiles.data?.get(enrollment.userId)

              return (
                <TableRow
                  key={enrollment.id}
                  tabIndex={0}
                  role="button"
                  onClick={() => setSelectedEnrollmentId(enrollment.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      setSelectedEnrollmentId(enrollment.id)
                    }
                  }}
                  className="group cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-hidden"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {(profile?.name?.[0] ?? "P").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground transition-colors group-hover:text-primary">
                          {profile?.name ?? enrollment.userId}
                        </p>
                        {profile?.email ? (
                          <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
                        ) : (
                          <p className="truncate font-mono text-[11px] text-muted-foreground">{enrollment.userId}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <EnrollmentStatusBadge status={enrollment.status} />
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                    {formatCourseDate(enrollment.enrolledAt, { full: false })}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(0, enrollment.progress))}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{enrollment.progress}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="w-10 pr-4 text-right">
                    <ChevronRight className="inline-block size-4 text-muted-foreground/50 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Pager page={page} totalPages={totalPages} disabled={enrollments.isFetching} onPageChange={setPage} />

      {selectedEnrollmentId ? (
        <Dialog open={selectedEnrollmentId !== null} onOpenChange={(open) => !open && setSelectedEnrollmentId(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader className="border-b pb-4">
              <div className="flex items-start justify-between gap-3 pr-6">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
                    {(selectedProfile?.name?.[0] ?? "P").toUpperCase()}
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold">
                      {selectedProfile?.name ?? selectedEnrollment?.userId}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      {selectedProfile?.email ?? "Peserta Pelatihan"}
                    </DialogDescription>
                  </div>
                </div>
                {selectedEnrollment && <EnrollmentStatusBadge status={selectedEnrollment.status} />}
              </div>
            </DialogHeader>

            {selectedEnrollment ? (
              <div className="space-y-4 py-2 text-sm">
                {/* Progres Belajar */}
                <div className="space-y-2.5 rounded-lg border bg-muted/20 p-3.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <BookOpen className="size-3.5 text-primary" /> Progres Pelatihan
                    </span>
                    <span className="font-bold text-foreground">{selectedEnrollment.progress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, selectedEnrollment.progress))}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="rounded border bg-background p-2">
                      <p className="text-[11px] text-muted-foreground">Materi Selesai</p>
                      <p className="mt-0.5 text-sm font-bold text-foreground">
                        {selectedEnrollment.completedLessons ?? 0}
                      </p>
                    </div>
                    <div className="rounded border bg-background p-2">
                      <p className="text-[11px] text-muted-foreground">Kuis Selesai</p>
                      <p className="mt-0.5 text-sm font-bold text-foreground">
                        {selectedEnrollment.completedQuizzes ?? 0}
                      </p>
                    </div>
                    <div className="rounded border bg-background p-2">
                      <p className="text-[11px] text-muted-foreground">Nilai Akhir</p>
                      <p className="mt-0.5 text-sm font-bold text-foreground">
                        {selectedEnrollment.finalGrade != null ? `${selectedEnrollment.finalGrade}/100` : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Detail Pendaftaran */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border p-3">
                    <span className="block text-[11px] text-muted-foreground">ID Pendaftaran</span>
                    <span
                      className="mt-0.5 block truncate font-mono font-medium text-foreground"
                      title={selectedEnrollment.id}
                    >
                      {selectedEnrollment.id}
                    </span>
                  </div>
                  <div className="rounded-lg border p-3">
                    <span className="block text-[11px] text-muted-foreground">Tanggal Terdaftar</span>
                    <span className="mt-0.5 block font-medium text-foreground">
                      {formatCourseDate(selectedEnrollment.enrolledAt, { full: true })}
                    </span>
                  </div>
                  {selectedEnrollment.approvedAt && (
                    <div className="rounded-lg border p-3">
                      <span className="block text-[11px] text-muted-foreground">Tanggal Diterima</span>
                      <span className="mt-0.5 block font-medium text-foreground">
                        {formatCourseDate(selectedEnrollment.approvedAt, { full: true })}
                      </span>
                    </div>
                  )}
                  {selectedEnrollment.completedAt && (
                    <div className="rounded-lg border p-3">
                      <span className="block text-[11px] text-muted-foreground">Tanggal Selesai</span>
                      <span className="mt-0.5 block font-medium text-foreground">
                        {formatCourseDate(selectedEnrollment.completedAt, { full: true })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Profil Tambahan */}
                {selectedProfile &&
                  (selectedProfile.profession ||
                    selectedProfile.institutionName ||
                    selectedProfile.phone ||
                    selectedProfile.strNumber) && (
                    <div className="space-y-2 rounded-lg border p-3.5">
                      <span className="block text-xs font-semibold text-muted-foreground">Data Diri Peserta</span>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {selectedProfile.profession && (
                          <div>
                            <span className="text-[11px] text-muted-foreground">Profesi</span>
                            <p className="font-medium text-foreground">{selectedProfile.profession}</p>
                          </div>
                        )}
                        {selectedProfile.institutionName && (
                          <div>
                            <span className="text-[11px] text-muted-foreground">Instansi</span>
                            <p className="font-medium text-foreground">{selectedProfile.institutionName}</p>
                          </div>
                        )}
                        {selectedProfile.phone && (
                          <div>
                            <span className="text-[11px] text-muted-foreground">No. Telepon / WA</span>
                            <p className="font-medium text-foreground">{selectedProfile.phone}</p>
                          </div>
                        )}
                        {selectedProfile.strNumber && (
                          <div>
                            <span className="text-[11px] text-muted-foreground">No. STR</span>
                            <p className="font-mono text-foreground">{selectedProfile.strNumber}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                {/* Status Sertifikat */}
                {selectedEnrollment.status === "graduated" && (
                  <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                        <Award className="size-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                          {selectedEnrollment.certificateId
                            ? "Sertifikat Sah Telah Terbit"
                            : "Lulus - Siap Terbit Sertifikat"}
                        </p>
                        {selectedEnrollment.certificateId ? (
                          <p className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                            ID: {selectedEnrollment.certificateId}
                          </p>
                        ) : (
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                            Klik tombol Terbitkan Sertifikat untuk mengeluarkan sertifikat resmi.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Catatan Penolakan/Kegagalan */}
                {selectedEnrollment.failureNotes && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs">
                    <span className="mb-1 flex items-center gap-1.5 font-semibold text-destructive">
                      <AlertCircle className="size-3.5" /> Catatan Tidak Lolos / Ditolak
                    </span>
                    <p className="text-destructive/90">{selectedEnrollment.failureNotes}</p>
                  </div>
                )}
              </div>
            ) : (
              <Skeleton className="h-48 w-full" />
            )}

            {selectedEnrollment && (
              <DialogFooter className="flex flex-row items-center justify-between gap-2 border-t pt-3 sm:justify-between">
                <div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={removeEnrollment.isPending}
                    onClick={() => {
                      void confirm({
                        title: "Keluarkan peserta?",
                        description: `Hapus data pendaftaran ${selectedProfile?.name ?? "peserta ini"} dari pelatihan secara permanen.`,
                        confirmLabel: "Keluarkan",
                        destructive: true,
                      }).then((ok) => {
                        if (ok) removeEnrollment.mutate(selectedEnrollment.id)
                      })
                    }}
                  >
                    <Trash2 className="mr-1 size-3.5" />
                    Keluarkan
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  {["registered", "selected"].includes(selectedEnrollment.status) ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="cursor-pointer"
                        disabled={updateStatus.isPending}
                        onClick={() =>
                          updateStatus.mutate({
                            id: selectedEnrollment.id,
                            status: "selected",
                          })
                        }
                      >
                        Terima
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="cursor-pointer"
                        disabled={updateStatus.isPending}
                        onClick={() => {
                          void confirm({
                            title: "Tolak peserta?",
                            description: `${selectedProfile?.name ?? "Peserta ini"} ditandai tidak lolos untuk pelatihan ini.`,
                            confirmLabel: "Tolak",
                            destructive: true,
                          }).then((ok) => {
                            if (ok)
                              updateStatus.mutate({
                                id: selectedEnrollment.id,
                                status: "failed",
                              })
                          })
                        }}
                      >
                        Tolak
                      </Button>
                    </>
                  ) : null}

                  {selectedEnrollment.status === "selected" ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="cursor-pointer"
                        disabled={updateStatus.isPending}
                        onClick={() => {
                          void confirm({
                            title: "Batalkan pendaftaran?",
                            description: `Pendaftaran ${selectedProfile?.name ?? "peserta ini"} dibatalkan dan aksesnya ke pelatihan dicabut.`,
                            confirmLabel: "Batalkan Pendaftaran",
                            cancelLabel: "Tutup",
                            destructive: true,
                          }).then((ok) => {
                            if (ok)
                              updateStatus.mutate({
                                id: selectedEnrollment.id,
                                status: "canceled",
                              })
                          })
                        }}
                      >
                        Batalkan
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        className="cursor-pointer"
                        disabled={updateStatus.isPending}
                        onClick={() =>
                          updateStatus.mutate({
                            id: selectedEnrollment.id,
                            status: "graduated",
                          })
                        }
                      >
                        Luluskan
                      </Button>
                    </>
                  ) : null}

                  {selectedEnrollment.status === "graduated" && !selectedEnrollment.certificateId ? (
                    <Button
                      size="sm"
                      variant="default"
                      className="cursor-pointer"
                      disabled={issueCertificate.isPending}
                      onClick={() => issueCertificate.mutate(selectedEnrollment.id)}
                    >
                      <Award className="mr-1 size-3.5" />
                      Terbitkan Sertifikat
                    </Button>
                  ) : null}

                  <Button
                    size="sm"
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => setSelectedEnrollmentId(null)}
                  >
                    Tutup
                  </Button>
                </div>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}
