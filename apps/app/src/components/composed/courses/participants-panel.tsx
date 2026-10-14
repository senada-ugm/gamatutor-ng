import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
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
 * Peserta tab: enrollment roster with the workflow actions the API
 * models as plain status transitions (select / fail / graduate / cancel).
 * Graduating auto-issues a certificate server-side.
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

  // Enrollment rows carry only userId; participant profiles (readable by
  // course managers) supply the display name/email. One batch read for
  // the whole roster — ids the caller may not see come back omitted, and
  // the row falls back to its userId.
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
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal mengubah status"),
  })

  const removeEnrollment = useMutation({
    mutationFn: (id: string) => apiSend<null>("DELETE", `/enrollments/${id}`),
    onSuccess: () => {
      toast.success("Peserta dikeluarkan dari pelatihan")
      void queryClient.invalidateQueries({
        queryKey: ["enrollments", courseId],
      })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal mengeluarkan peserta"),
  })

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
        <h2 className="text-lg font-medium">Peserta</h2>
        <p className="text-sm text-muted-foreground">{totalCount} pendaftar</p>
      </div>
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Peserta</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Terdaftar</TableHead>
              <TableHead className="hidden md:table-cell">Progres</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((enrollment) => {
              const isActive = ["registered", "interviewed", "selected"].includes(enrollment.status)
              const profile = profiles.data?.get(enrollment.userId)

              return (
                <TableRow key={enrollment.id}>
                  <TableCell>
                    <p className="font-medium">{profile?.name ?? enrollment.userId}</p>
                    {profile?.email ? <p className="text-xs text-muted-foreground">{profile.email}</p> : null}
                  </TableCell>
                  <TableCell>
                    <EnrollmentStatusBadge status={enrollment.status} />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {formatCourseDate(enrollment.enrolledAt, { full: false })}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{enrollment.progress}%</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {isActive ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updateStatus.isPending}
                            onClick={() =>
                              updateStatus.mutate({
                                id: enrollment.id,
                                status: "selected",
                              })
                            }
                          >
                            Terima
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={updateStatus.isPending}
                            onClick={() => {
                              void confirm({
                                title: "Tolak peserta?",
                                description: `${profile?.name ?? "Peserta ini"} ditandai tidak lolos untuk pelatihan ini.`,
                                confirmLabel: "Tolak",
                                destructive: true,
                              }).then((ok) => {
                                if (ok)
                                  updateStatus.mutate({
                                    id: enrollment.id,
                                    status: "failed",
                                  })
                              })
                            }}
                          >
                            Tolak
                          </Button>
                        </>
                      ) : null}
                      {enrollment.status === "selected" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updateStatus.isPending}
                          onClick={() =>
                            updateStatus.mutate({
                              id: enrollment.id,
                              status: "graduated",
                            })
                          }
                        >
                          Luluskan
                        </Button>
                      ) : null}
                      {enrollment.status === "graduated" && !enrollment.certificateId ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={issueCertificate.isPending}
                          onClick={() => issueCertificate.mutate(enrollment.id)}
                        >
                          Terbitkan Sertifikat
                        </Button>
                      ) : null}
                      {isActive ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={updateStatus.isPending}
                          onClick={() => {
                            void confirm({
                              title: "Batalkan pendaftaran?",
                              description: `Pendaftaran ${profile?.name ?? "peserta ini"} dibatalkan dan aksesnya ke pelatihan dicabut.`,
                              confirmLabel: "Batalkan Pendaftaran",
                              cancelLabel: "Tutup",
                              destructive: true,
                            }).then((ok) => {
                              if (ok)
                                updateStatus.mutate({
                                  id: enrollment.id,
                                  status: "canceled",
                                })
                            })
                          }}
                        >
                          Batalkan
                        </Button>
                      ) : null}
                      <Button size="sm" variant="outline" onClick={() => setSelectedEnrollmentId(enrollment.id)}>
                        Detail
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={removeEnrollment.isPending}
                        onClick={() => {
                          void confirm({
                            title: "Keluarkan peserta?",
                            description: `Hapus data pendaftaran ${profile?.name ?? "peserta ini"} dari pelatihan secara permanen.`,
                            confirmLabel: "Keluarkan",
                            destructive: true,
                          }).then((ok) => {
                            if (ok) removeEnrollment.mutate(enrollment.id)
                          })
                        }}
                      >
                        Keluarkan
                      </Button>
                    </div>
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detail Pendaftaran Peserta</DialogTitle>
              <DialogDescription>Informasi lengkap pendaftaran dan evaluasi peserta.</DialogDescription>
            </DialogHeader>
            {enrollmentDetail.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : enrollmentDetail.data ? (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-muted-foreground">ID Pendaftaran</span>
                    <p className="font-mono text-xs">{enrollmentDetail.data.id}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Status</span>
                    <EnrollmentStatusBadge status={enrollmentDetail.data.status} />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Tanggal Terdaftar</span>
                    <p className="text-muted-foreground">
                      {formatCourseDate(enrollmentDetail.data.enrolledAt, { full: true })}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Sertifikat ID</span>
                    <p className="font-mono text-xs">{enrollmentDetail.data.certificateId || "—"}</p>
                  </div>
                </div>
                {enrollmentDetail.data.interviewNotes ? (
                  <div>
                    <span className="text-xs text-muted-foreground">Catatan Wawancara</span>
                    <p className="rounded bg-muted p-2 text-xs">{enrollmentDetail.data.interviewNotes}</p>
                  </div>
                ) : null}
                {enrollmentDetail.data.failureNotes ? (
                  <div>
                    <span className="text-xs text-muted-foreground">Alasan Tidak Lolos</span>
                    <p className="rounded bg-destructive/10 p-2 text-xs text-destructive">
                      {enrollmentDetail.data.failureNotes}
                    </p>
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
