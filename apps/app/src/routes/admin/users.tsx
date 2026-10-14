import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"

import { EmptyState } from "@/components/composed/_shared/empty-state"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { SearchInput, useDebouncedValue } from "@/components/composed/_shared/search-input"
import { Pager } from "@/components/composed/_shared/pager"
import { apiGet, apiGetPaged, apiSend } from "@/lib/api"
import { formatCourseDate } from "@/lib/lms-date"
import type { ContractUser, ContractUserCapabilities } from "@workspace/contracts/domain"

/**
 * Admin user management: searchable account list with ownership/
 * instructor badges from one batched capabilities call, plus real
 * suspend/reactivate.
 */

export function AdminUsersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search)
  const [page, setPage] = useState(1)
  const [suspendReasonId, setSuspendReasonId] = useState<string | null>(null)
  const [suspendReason, setSuspendReason] = useState("")
  const [detailUserId, setDetailUserId] = useState<string | null>(null)

  const users = useQuery({
    queryKey: ["admin-users", debouncedSearch, page],
    queryFn: () =>
      apiGetPaged<ContractUser>(`/users?search=${encodeURIComponent(debouncedSearch)}&page=${page}&pageSize=20`),
  })

  const detailUser = useQuery({
    queryKey: ["admin-user-detail", detailUserId],
    queryFn: () => apiGet<ContractUser>(`/users/${detailUserId}`),
    enabled: detailUserId !== null,
  })

  const ids = (users.data?.data ?? []).map((u) => u.id).join(",")
  const capabilities = useQuery({
    queryKey: ["user-capabilities", ids],
    queryFn: () => apiGet<ContractUserCapabilities[]>(`/users/user-capabilities?userIds=${ids}`),
    enabled: ids !== "",
    select: (list) => new Map(list.map((c) => [c.userId, c])),
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["admin-users"] })
  }

  const suspend = useMutation({
    mutationFn: (input: { id: string; suspend: boolean; reason?: string }) =>
      apiSend<ContractUser>(
        "POST",
        `/users/${input.id}/${input.suspend ? "suspend" : "reactivate"}`,
        input.suspend ? { reason: input.reason } : undefined
      ),
    onSuccess: (_data, input) => {
      toast.success(input.suspend ? "Akun dibekukan" : "Akun diaktifkan kembali")
      setSuspendReasonId(null)
      setSuspendReason("")
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal memperbarui akun"),
  })

  const rows = users.data?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manajemen Pengguna"
        description={`${users.data?.pagination.totalCount ?? rows.length} akun terdaftar.`}
      />

      <SearchInput
        label="Cari pengguna"
        placeholder="Cari nama atau email…"
        value={search}
        onChange={(next) => {
          setSearch(next)
          setPage(1)
        }}
      />

      {users.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : users.isError ? (
        <ErrorState error={users.error} onRetry={() => void users.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="Tidak ada akun" description="Coba kata kunci lain." />
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Peran</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Bergabung</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((user) => {
                const caps = capabilities.data?.get(user.id)
                const suspended = user.status === "suspended"
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <p className="font-medium">{user.name}</p>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {caps?.ownedInstitutionIds?.length ? <Badge variant="outline">Pemilik Institusi</Badge> : null}
                        {caps?.isInstructor ? <Badge variant="outline">Instruktur</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                        {user.role === "admin" ? "Admin" : "Pengguna"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={suspended ? "destructive" : "outline"}>{suspended ? "Dibekukan" : "Aktif"}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatCourseDate(user.joinedAt, { full: false })}
                    </TableCell>
                    <TableCell className="text-right">
                      {suspendReasonId === user.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            className="h-7 w-44"
                            placeholder="Alasan pembekuan"
                            value={suspendReason}
                            onChange={(e) => setSuspendReason(e.target.value)}
                          />
                          <Button
                            size="sm"
                            disabled={suspend.isPending || !suspendReason.trim()}
                            onClick={() =>
                              suspend.mutate({
                                id: user.id,
                                suspend: true,
                                reason: suspendReason.trim(),
                              })
                            }
                          >
                            Simpan
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSuspendReasonId(null)
                              setSuspendReason("")
                            }}
                          >
                            Batal
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => setDetailUserId(user.id)}>
                            Detail
                          </Button>
                          <Button
                            size="sm"
                            variant={suspended ? "outline" : "ghost"}
                            disabled={suspend.isPending}
                            onClick={() => {
                              if (suspended) {
                                suspend.mutate({ id: user.id, suspend: false })
                                return
                              }
                              setSuspendReasonId(user.id)
                              setSuspendReason("")
                            }}
                          >
                            {suspended ? "Aktifkan" : "Bekukan"}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {detailUserId ? (
        <Dialog open={detailUserId !== null} onOpenChange={(open) => !open && setDetailUserId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detail Pengguna</DialogTitle>
              <DialogDescription>Informasi lengkap akun pengguna.</DialogDescription>
            </DialogHeader>
            {detailUser.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : detailUser.data ? (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-muted-foreground">ID Pengguna</span>
                    <p className="font-mono text-xs">{detailUser.data.id}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Status</span>
                    <p>
                      <Badge variant={detailUser.data.status === "suspended" ? "destructive" : "outline"}>
                        {detailUser.data.status === "suspended" ? "Dibekukan" : "Aktif"}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Nama</span>
                    <p className="font-medium">{detailUser.data.name}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Email</span>
                    <p className="text-muted-foreground">{detailUser.data.email}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Peran</span>
                    <p className="capitalize">{detailUser.data.role === "admin" ? "Admin" : "Pengguna"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Bergabung</span>
                    <p className="text-muted-foreground">
                      {formatCourseDate(detailUser.data.joinedAt, { full: true })}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}

      <Pager
        page={page}
        totalPages={users.data?.pagination.totalPages ?? 1}
        disabled={users.isFetching}
        onPageChange={setPage}
      />
    </div>
  )
}
