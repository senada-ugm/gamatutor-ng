import { Fragment, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { EmptyState } from "@/components/composed/_shared/empty-state"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { useConfirm } from "@/components/composed/_shared/confirm-dialog"
import { ImageUploadField } from "@/components/composed/_shared/image-upload-field"
import { InstitutionLogo } from "@/components/composed/_shared/institution-logo"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { Pager } from "@/components/composed/_shared/pager"
import { apiGet, apiGetPaged, apiSend } from "@/lib/api"
import { INSTITUTION_TYPES } from "@/lib/labels"
import { formatCourseDate } from "@/lib/lms-date"
import type { ContractRegisteredInstitution, ContractInstitutionRequest } from "@workspace/contracts/domain"

/**
 * Admin institutions surface: the registered-institution list with
 * inline edit, the direct-create form (grants ownership immediately),
 * and the self-service request queue with approve/reject.
 */

const PAGE_SIZE = 20

export function AdminInstitutionsPage() {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [grantInstitutionId, setGrantInstitutionId] = useState<string | null>(null)
  const [grantUserId, setGrantUserId] = useState("")

  const institutions = useQuery({
    queryKey: ["institutions", page],
    queryFn: () => apiGetPaged<ContractRegisteredInstitution>(`/institutions?page=${page}&pageSize=${PAGE_SIZE}`),
  })

  const requests = useQuery({
    queryKey: ["institution-requests", "pending"],
    queryFn: () => apiGet<ContractInstitutionRequest[]>("/institution-requests?pageSize=50"),
  })

  const requestDetail = useQuery({
    queryKey: ["admin-institution-request-detail", selectedRequestId],
    queryFn: () => apiGet<ContractInstitutionRequest>(`/institution-requests/${selectedRequestId}`),
    enabled: selectedRequestId !== null,
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["institutions"] })
    void queryClient.invalidateQueries({ queryKey: ["institution-requests"] })
  }

  const createInstitution = useMutation({
    mutationFn: (values: InstitutionFormValues) =>
      apiSend<ContractRegisteredInstitution>("POST", "/institutions", toInstitutionPayload(values)),
    onSuccess: () => {
      toast.success("Institusi dibuat")
      setShowCreate(false)
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal membuat institusi"),
  })

  const updateInstitution = useMutation({
    mutationFn: (input: { id: string; values: InstitutionFormValues }) =>
      apiSend<ContractRegisteredInstitution>("PATCH", `/institutions/${input.id}`, toInstitutionPayload(input.values)),
    onSuccess: () => {
      toast.success("Institusi diperbarui")
      setEditingId(null)
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal memperbarui institusi"),
  })

  const grantOwnership = useMutation({
    mutationFn: (input: { institutionId: string; userId: string }) =>
      apiSend<{ id: string; userId: string; institutionId: string }>("POST", "/institution-ownerships", input),
    onSuccess: () => {
      toast.success("Akses kepemilikan diberikan")
      setGrantInstitutionId(null)
      setGrantUserId("")
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal memberikan akses"),
  })

  const decideRequest = useMutation({
    mutationFn: (input: { id: string; approve: boolean }) =>
      apiSend<ContractInstitutionRequest>(
        "POST",
        `/institution-requests/${input.id}/${input.approve ? "approve" : "reject"}`
      ),
    onSuccess: (_data, input) => {
      toast.success(input.approve ? "Permohonan disetujui" : "Permohonan ditolak")
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal memproses permohonan"),
  })

  const pending = (requests.data ?? []).filter((r) => r.status === "pending")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institusi"
        description="Institusi terdaftar dan antrean permohonan."
        actions={<Button onClick={() => setShowCreate((v) => !v)}>Tambah Institusi</Button>}
      />

      {showCreate ? (
        <InstitutionForm
          title="Institusi Baru"
          submitLabel="Buat Institusi"
          submitting={createInstitution.isPending}
          onSubmit={(values) => createInstitution.mutate(values)}
          onCancel={() => setShowCreate(false)}
        />
      ) : null}

      <Tabs defaultValue="registered">
        <TabsList>
          <TabsTrigger value="registered">Terdaftar ({institutions.data?.pagination.totalCount ?? 0})</TabsTrigger>
          <TabsTrigger value="pending">Permohonan Menunggu ({pending.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="registered" className="space-y-3">
          {institutions.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : institutions.isError ? (
            <ErrorState error={institutions.error} onRetry={() => void institutions.refetch()} />
          ) : (institutions.data?.data ?? []).length === 0 ? (
            <EmptyState title="Belum ada institusi" />
          ) : (
            <ItemGroup>
              {(institutions.data?.data ?? []).map((institution, index) =>
                editingId === institution.id ? (
                  <InstitutionForm
                    key={institution.id}
                    title={`Edit: ${institution.name}`}
                    initial={institutionFormValuesFromInstitution(institution)}
                    submitLabel="Simpan Perubahan"
                    submitting={updateInstitution.isPending}
                    onSubmit={(values) => updateInstitution.mutate({ id: institution.id, values })}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <Fragment key={institution.id}>
                    {index > 0 ? <ItemSeparator /> : null}
                    <Item>
                      <ItemContent>
                        <ItemTitle>
                          {institution.name}
                          <Badge variant="outline">
                            {INSTITUTION_TYPES.find((t) => t.value === institution.institutionType)?.label ??
                              institution.institutionType}
                          </Badge>
                        </ItemTitle>
                        <ItemDescription className="line-clamp-1 text-xs">
                          {[
                            institution.email,
                            institution.website,
                            `Sejak ${formatCourseDate(institution.createdAt, { dateOnly: true })}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Button size="sm" variant="outline" onClick={() => setGrantInstitutionId(institution.id)}>
                          Beri Akses
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(institution.id)}>
                          Edit
                        </Button>
                      </ItemActions>
                    </Item>
                  </Fragment>
                )
              )}
            </ItemGroup>
          )}
          <Pager
            page={page}
            totalPages={institutions.data?.pagination.totalPages ?? 1}
            disabled={institutions.isFetching}
            onPageChange={setPage}
          />
        </TabsContent>

        <TabsContent value="pending" className="space-y-3">
          {requests.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : requests.isError ? (
            <ErrorState error={requests.error} onRetry={() => void requests.refetch()} />
          ) : pending.length === 0 ? (
            <EmptyState
              title="Tidak ada permohonan"
              description="Permohonan pendaftaran institusi akan muncul di sini."
            />
          ) : (
            <ItemGroup>
              {pending.map((request, index) => (
                <Fragment key={request.id}>
                  {index > 0 ? <ItemSeparator /> : null}
                  <Item>
                    <ItemContent>
                      <ItemTitle>
                        {request.institutionName}
                        <Badge variant="outline">
                          {INSTITUTION_TYPES.find((t) => t.value === request.institutionType)?.label ??
                            request.institutionType}
                        </Badge>
                      </ItemTitle>
                      {request.justification ? <ItemDescription>{request.justification}</ItemDescription> : null}
                      <ItemDescription className="line-clamp-1 text-xs">
                        Diajukan oleh {request.requestedByUser?.name ?? request.requestedByUser?.email ?? "—"}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Button size="sm" variant="outline" onClick={() => setSelectedRequestId(request.id)}>
                        Detail
                      </Button>
                      <Button
                        size="sm"
                        disabled={decideRequest.isPending}
                        onClick={() =>
                          decideRequest.mutate({
                            id: request.id,
                            approve: true,
                          })
                        }
                      >
                        Setujui
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={decideRequest.isPending}
                        onClick={() => {
                          void confirm({
                            title: "Tolak permohonan?",
                            description: `Permohonan "${request.institutionName}" ditolak dan pemohon diberi tahu.`,
                            confirmLabel: "Tolak",
                            destructive: true,
                          }).then((ok) => {
                            if (ok)
                              decideRequest.mutate({
                                id: request.id,
                                approve: false,
                              })
                          })
                        }}
                      >
                        Tolak
                      </Button>
                    </ItemActions>
                  </Item>
                </Fragment>
              ))}
            </ItemGroup>
          )}
        </TabsContent>
      </Tabs>

      {grantInstitutionId ? (
        <Dialog open={grantInstitutionId !== null} onOpenChange={(open) => !open && setGrantInstitutionId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Beri Akses Pemilik Institusi</DialogTitle>
              <DialogDescription>
                Berikan hak kepemilikan institusi kepada pengguna berdasarkan ID Pengguna.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!grantUserId.trim()) {
                  toast.error("ID Pengguna wajib diisi")
                  return
                }
                grantOwnership.mutate({ institutionId: grantInstitutionId, userId: grantUserId.trim() })
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="grant-user-id">ID Pengguna</Label>
                <Input
                  id="grant-user-id"
                  placeholder="usr_..."
                  value={grantUserId}
                  onChange={(e) => setGrantUserId(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setGrantInstitutionId(null)}>
                  Batal
                </Button>
                <Button type="submit" disabled={grantOwnership.isPending}>
                  {grantOwnership.isPending ? "Menyimpan..." : "Beri Akses"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}

      {selectedRequestId ? (
        <Dialog open={selectedRequestId !== null} onOpenChange={(open) => !open && setSelectedRequestId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detail Permohonan Institusi</DialogTitle>
              <DialogDescription>Rincian lengkap pengajuan pendaftaran institusi.</DialogDescription>
            </DialogHeader>
            {requestDetail.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : requestDetail.data ? (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-muted-foreground">Institusi</span>
                    <p className="font-medium">{requestDetail.data.institutionName}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Tipe</span>
                    <p className="capitalize">{requestDetail.data.institutionType}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Pemohon</span>
                    <p>
                      {requestDetail.data.requestedByUser?.name ?? requestDetail.data.requestedByUser?.email ?? "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Status</span>
                    <p className="capitalize">{requestDetail.data.status}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Email</span>
                    <p className="text-muted-foreground">{requestDetail.data.email || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Telepon</span>
                    <p className="text-muted-foreground">{requestDetail.data.phone || "—"}</p>
                  </div>
                </div>
                {requestDetail.data.justification ? (
                  <div>
                    <span className="text-xs text-muted-foreground">Alasan Pengajuan</span>
                    <p className="rounded bg-muted p-2 text-xs">{requestDetail.data.justification}</p>
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

interface InstitutionFormValues {
  name: string
  institutionType: string
  description: string
  website: string
  email: string
  phone: string
  address: string
  logo: string
}

function institutionFormValuesFromInstitution(institution: ContractRegisteredInstitution): InstitutionFormValues {
  return {
    name: institution.name,
    institutionType: institution.institutionType,
    description: institution.description ?? "",
    website: institution.website ?? "",
    email: institution.email ?? "",
    phone: institution.phone ?? "",
    address: institution.address ?? "",
    logo: institution.logo ?? "",
  }
}

function toInstitutionPayload(values: InstitutionFormValues) {
  return {
    name: values.name,
    institutionType: values.institutionType,
    description: values.description || undefined,
    website: values.website || undefined,
    email: values.email || undefined,
    phone: values.phone || undefined,
    address: values.address || undefined,
    logo: values.logo || null,
  }
}

function InstitutionForm({
  title,
  initial,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
}: {
  title: string
  initial?: InstitutionFormValues
  submitLabel: string
  submitting: boolean
  onSubmit: (values: InstitutionFormValues) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState<InstitutionFormValues>(
    initial ?? {
      name: "",
      institutionType: "company",
      description: "",
      website: "",
      email: "",
      phone: "",
      address: "",
      logo: "",
    }
  )

  function update<TKey extends keyof InstitutionFormValues>(key: TKey, value: InstitutionFormValues[TKey]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.name.trim()) {
      toast.error("Nama institusi wajib diisi")
      return
    }
    onSubmit(values)
  }

  return (
    <Card className="max-w-3xl">
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <h3 className="font-medium">{title}</h3>
          <ImageUploadField
            id="institution-logo"
            label="Logo (opsional)"
            purpose="logo"
            value={values.logo}
            onChange={(url) => update("logo", url)}
            preview={<InstitutionLogo logo={values.logo} placeholder className="size-16 shrink-0 rounded-lg border" />}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="institution-name">Nama</Label>
              <Input id="institution-name" value={values.name} onChange={(e) => update("name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="institution-type">Jenis</Label>
              <NativeSelect
                id="institution-type"
                className="w-full"
                value={values.institutionType}
                onChange={(e) => update("institutionType", e.target.value)}
              >
                {INSTITUTION_TYPES.map((t) => (
                  <NativeSelectOption key={t.value} value={t.value}>
                    {t.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="institution-email">Email (opsional)</Label>
              <Input
                id="institution-email"
                type="email"
                value={values.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="institution-phone">Telepon (opsional)</Label>
              <Input id="institution-phone" value={values.phone} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="institution-website">Website (opsional)</Label>
              <Input
                id="institution-website"
                value={values.website}
                onChange={(e) => update("website", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="institution-address">Alamat (opsional)</Label>
              <Input
                id="institution-address"
                value={values.address}
                onChange={(e) => update("address", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="institution-description">Deskripsi (opsional)</Label>
            <Textarea
              id="institution-description"
              rows={3}
              value={values.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Menyimpan..." : submitLabel}
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
