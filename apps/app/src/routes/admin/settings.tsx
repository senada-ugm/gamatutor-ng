import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { PageHeader } from "@/components/composed/_shared/page-header"
import { apiGet, apiSend } from "@/lib/api"
import type { ContractPlatformSettings } from "@workspace/contracts/domain"

export function AdminSettingsPage() {
  const queryClient = useQueryClient()

  const settings = useQuery({
    queryKey: ["platform-settings"],
    queryFn: () => apiGet<ContractPlatformSettings>("/platform-settings"),
  })

  const [draft, setDraft] = useState<ContractPlatformSettings | null>(null)
  if (settings.data && draft === null) setDraft(settings.data)

  const save = useMutation({
    mutationFn: (next: ContractPlatformSettings) =>
      apiSend<ContractPlatformSettings>("PATCH", "/platform-settings", {
        platformName: next.platformName,
        supportEmail: next.supportEmail,
        supportPhone: next.supportPhone ?? null,
        maintenanceMode: next.maintenanceMode,
        allowInstitutionRequests: next.allowInstitutionRequests,
        certificateValidityMonths: next.certificateValidityMonths,
      }),
    onSuccess: (data) => {
      toast.success("Pengaturan platform disimpan")
      setDraft(data)
      void queryClient.invalidateQueries({ queryKey: ["platform-settings"] })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menyimpan pengaturan"),
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Pengaturan Platform" description="Konfigurasi global yang berlaku untuk seluruh aplikasi." />

      {settings.isLoading || !draft ? (
        <Skeleton className="h-64 w-full max-w-3xl" />
      ) : (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Umum</CardTitle>
            <CardDescription>Identitas platform dan kanal dukungan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="platform-name">Nama Platform</Label>
                <Input
                  id="platform-name"
                  value={draft.platformName}
                  onChange={(e) => setDraft({ ...draft, platformName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="support-email">Email Dukungan</Label>
                <Input
                  id="support-email"
                  type="email"
                  value={draft.supportEmail}
                  onChange={(e) => setDraft({ ...draft, supportEmail: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="support-phone">Telepon Dukungan (opsional)</Label>
                <Input
                  id="support-phone"
                  value={draft.supportPhone ?? ""}
                  onChange={(e) => setDraft({ ...draft, supportPhone: e.target.value || undefined })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="certificate-validity">Masa Berlaku Sertifikat (bulan)</Label>
                <Input
                  id="certificate-validity"
                  type="number"
                  min={1}
                  max={120}
                  value={draft.certificateValidityMonths}
                  onChange={(e) => setDraft({ ...draft, certificateValidityMonths: Number(e.target.value) || 1 })}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={draft.allowInstitutionRequests}
                onCheckedChange={(c) => setDraft({ ...draft, allowInstitutionRequests: c === true })}
              />
              Izinkan pengguna mengajukan institusi baru
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={draft.maintenanceMode}
                onCheckedChange={(c) => setDraft({ ...draft, maintenanceMode: c === true })}
              />
              Mode pemeliharaan
            </label>

            <div className="flex justify-end border-t pt-4">
              <Button onClick={() => save.mutate(draft)} disabled={save.isPending}>
                {save.isPending ? "Menyimpan..." : "Simpan Pengaturan"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
