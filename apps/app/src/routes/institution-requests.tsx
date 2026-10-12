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
import { Textarea } from "@workspace/ui/components/textarea"

import { EmptyState } from "@/components/composed/_shared/empty-state"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { ImageUploadField } from "@/components/composed/_shared/image-upload-field"
import { InstitutionLogo } from "@/components/composed/_shared/institution-logo"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { apiGet, apiSend } from "@/lib/api"
import { INSTITUTION_TYPES } from "@/lib/labels"
import { formatCourseDate } from "@/lib/lms-date"
import type { ContractInstitutionRequest } from "@workspace/contracts/domain"

/**
 * Self-service institution request: any signed-in account can propose a
 * new institution; an admin's approval grants ownership (the admin-side
 * queue lives in /admin/institutions). Non-admins only ever see their
 * own requests here — the API scopes it.
 */

const STATUS_BADGES = {
  pending: { label: "Menunggu", variant: "secondary" as const },
  approved: { label: "Disetujui", variant: "default" as const },
  rejected: { label: "Ditolak", variant: "destructive" as const },
}

interface RequestFormValues {
  institutionName: string
  institutionType: string
  description: string
  justification: string
  email: string
  phone: string
  website: string
  address: string
  logo: string
}

export function InstitutionRequestsPage() {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<RequestFormValues>({
    institutionName: "",
    institutionType: "company",
    description: "",
    justification: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    logo: "",
  })

  const myRequests = useQuery({
    queryKey: ["my-institution-requests"],
    queryFn: () => apiGet<ContractInstitutionRequest[]>("/institution-requests?pageSize=50"),
  })

  const submit = useMutation({
    mutationFn: () =>
      apiSend<ContractInstitutionRequest>("POST", "/institution-requests", {
        institutionName: values.institutionName,
        institutionType: values.institutionType,
        description: values.description || undefined,
        justification: values.justification || undefined,
        email: values.email || undefined,
        phone: values.phone || undefined,
        website: values.website || undefined,
        address: values.address || undefined,
        logo: values.logo || null,
      }),
    onSuccess: () => {
      toast.success("Permohonan dikirim", {
        description: "Anda akan menjadi pemilik institusi setelah disetujui.",
      })
      setValues((prev) => ({
        ...prev,
        institutionName: "",
        justification: "",
        description: "",
        logo: "",
      }))
      void queryClient.invalidateQueries({
        queryKey: ["my-institution-requests"],
      })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal mengirim permohonan"),
  })

  function update<TKey extends keyof RequestFormValues>(key: TKey, value: RequestFormValues[TKey]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.institutionName.trim()) {
      toast.error("Nama institusi wajib diisi")
      return
    }
    submit.mutate()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        backTo="/dashboard"
        backLabel="Dasbor"
        title="Ajukan Institusi"
        description="Usulkan institusi baru — setelah disetujui admin, Anda menjadi pemiliknya dan dapat membuat pelatihan di bawahnya."
      />

      <Card className="max-w-3xl">
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <ImageUploadField
              id="request-logo"
              label="Logo Institusi (opsional)"
              purpose="logo"
              value={values.logo}
              onChange={(url) => update("logo", url)}
              preview={
                <InstitutionLogo logo={values.logo} placeholder className="size-16 shrink-0 rounded-lg border" />
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="request-name">Nama Institusi</Label>
                <Input
                  id="request-name"
                  value={values.institutionName}
                  onChange={(e) => update("institutionName", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="request-type">Jenis</Label>
                <NativeSelect
                  id="request-type"
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
                <Label htmlFor="request-email">Email (opsional)</Label>
                <Input
                  id="request-email"
                  type="email"
                  value={values.email}
                  onChange={(e) => update("email", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="request-phone">Telepon (opsional)</Label>
                <Input id="request-phone" value={values.phone} onChange={(e) => update("phone", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="request-website">Website (opsional)</Label>
                <Input
                  id="request-website"
                  value={values.website}
                  onChange={(e) => update("website", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="request-address">Alamat (opsional)</Label>
                <Input
                  id="request-address"
                  value={values.address}
                  onChange={(e) => update("address", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="request-description">Deskripsi (opsional)</Label>
              <Textarea
                id="request-description"
                rows={2}
                value={values.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="request-justification">Alasan Pengajuan (opsional)</Label>
              <Textarea
                id="request-justification"
                rows={3}
                value={values.justification}
                onChange={(e) => update("justification", e.target.value)}
                placeholder="Ceritakan singkat tentang institusi Anda dan rencana penyelenggaraan pelatihan"
              />
            </div>
            <Button type="submit" disabled={submit.isPending}>
              {submit.isPending ? "Mengirim..." : "Kirim Permohonan"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Permohonan Saya</h2>
        {myRequests.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : myRequests.isError ? (
          <ErrorState error={myRequests.error} onRetry={() => void myRequests.refetch()} />
        ) : (myRequests.data ?? []).length === 0 ? (
          <EmptyState title="Belum ada permohonan" description="Permohonan yang Anda ajukan akan muncul di sini." />
        ) : (
          <ItemGroup>
            {(myRequests.data ?? []).map((request, index) => {
              const badge = STATUS_BADGES[request.status] ?? STATUS_BADGES.pending
              return (
                <Fragment key={request.id}>
                  {index > 0 ? <ItemSeparator /> : null}
                  <Item>
                    <ItemContent>
                      <ItemTitle>{request.institutionName}</ItemTitle>
                      <ItemDescription className="line-clamp-1 text-xs">
                        Diajukan {formatCourseDate(request.createdAt, { full: false })}
                        {request.rejectionReason ? ` · Ditolak: ${request.rejectionReason}` : ""}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </ItemActions>
                  </Item>
                </Fragment>
              )
            })}
          </ItemGroup>
        )}
      </section>
    </div>
  )
}
