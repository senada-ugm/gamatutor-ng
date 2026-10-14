import { useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { EmptyState } from "@/components/composed/_shared/empty-state"
import { apiGet, apiSend } from "@/lib/api"
import { uploadFile } from "@/lib/uploads"
import type { ContractCertificateSettings, ContractCertificateSignature } from "@workspace/contracts/domain"

/**
 * The course editor's Sertifikat tab — per-course certificate signature
 * configuration. Signatures live on their own settings resource (not a
 * course column), so edits here never touch the course row.
 */

const PLACEMENT_OPTIONS: {
  value: ContractCertificateSignature["placement"]
  label: string
}[] = [
  { value: "left", label: "Kiri" },
  { value: "center", label: "Tengah" },
  { value: "right", label: "Kanan" },
]

export function CertificateSettingsEditor({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient()
  const [signatures, setSignatures] = useState<ContractCertificateSignature[] | null>(null)

  const settings = useQuery({
    queryKey: ["certificate-settings", courseId],
    queryFn: () => apiGet<ContractCertificateSettings>(`/courses/${courseId}/certificate-settings`),
  })

  // Local editable copy seeded once from the server response.
  if (settings.data && signatures === null) {
    setSignatures(settings.data.signatures)
  }

  const save = useMutation({
    mutationFn: (next: ContractCertificateSignature[]) =>
      apiSend<ContractCertificateSettings>("PATCH", `/courses/${courseId}/certificate-settings`, {
        signatures: next,
      }),
    onSuccess: (data) => {
      toast.success("Pengaturan sertifikat disimpan")
      setSignatures(data.signatures)
      void queryClient.invalidateQueries({
        queryKey: ["certificate-settings", courseId],
      })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menyimpan pengaturan"),
  })

  if (settings.isLoading) {
    return <Skeleton className="h-48 w-full" />
  }

  const current = signatures ?? []

  function addSignature() {
    if (current.length >= 3) {
      toast.error("Maksimal 3 penandatangan")
      return
    }
    const newId = current.length > 0 ? Math.max(...current.map((s) => s.id)) + 1 : 1
    setSignatures([...current, { id: newId, name: "", placement: "left" }])
  }

  function updateSignature(id: number, field: "name" | "title" | "signatureUrl", value: string) {
    setSignatures(
      current.map((sig) => {
        if (sig.id !== id) return sig
        if (field === "name") return { ...sig, name: value }
        if (field === "title") return { ...sig, title: value || undefined }
        return { ...sig, signatureUrl: value || undefined }
      })
    )
  }

  function updatePlacement(id: number, placement: ContractCertificateSignature["placement"]) {
    if (current.some((sig) => sig.id !== id && sig.placement === placement)) {
      toast.error("Posisi tersebut sudah digunakan penandatangan lain")
      return
    }
    setSignatures(current.map((sig) => (sig.id === id ? { ...sig, placement } : sig)))
  }

  function removeSignature(id: number) {
    setSignatures(current.filter((sig) => sig.id !== id))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tanda Tangan Sertifikat</CardTitle>
        <CardDescription>
          Tanda tangan yang muncul di sertifikat kelulusan (maksimal 3 penandatangan, satu per posisi).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {current.length === 0 ? (
          <EmptyState
            compact
            title="Belum ada penandatangan"
            description="Tambahkan hingga tiga penandatangan sertifikat."
          />
        ) : (
          current.map((signature, index) => (
            <div key={signature.id} className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Penandatangan {index + 1}</h4>
                <Button size="sm" variant="ghost" onClick={() => removeSignature(signature.id)}>
                  Hapus
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`sig-name-${signature.id}`}>Nama</Label>
                  <Input
                    id={`sig-name-${signature.id}`}
                    value={signature.name}
                    onChange={(e) => updateSignature(signature.id, "name", e.target.value)}
                    placeholder="Nama penandatangan"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`sig-title-${signature.id}`}>Jabatan (opsional)</Label>
                  <Input
                    id={`sig-title-${signature.id}`}
                    value={signature.title ?? ""}
                    onChange={(e) => updateSignature(signature.id, "title", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`sig-placement-${signature.id}`}>Posisi</Label>
                  <NativeSelect
                    id={`sig-placement-${signature.id}`}
                    className="w-full"
                    value={signature.placement}
                    onChange={(e) =>
                      updatePlacement(signature.id, e.target.value as ContractCertificateSignature["placement"])
                    }
                  >
                    {PLACEMENT_OPTIONS.map((option) => (
                      <NativeSelectOption
                        key={option.value}
                        value={option.value}
                        disabled={current.some((s) => s.id !== signature.id && s.placement === option.value)}
                      >
                        {option.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                <SignatureImageInput
                  signatureUrl={signature.signatureUrl}
                  onChange={(url) => updateSignature(signature.id, "signatureUrl", url)}
                />
              </div>
            </div>
          ))
        )}

        {current.length < 3 ? (
          <Button variant="outline" className="w-full border-dashed" onClick={addSignature}>
            + Tambah Penandatangan
          </Button>
        ) : null}

        <div className="flex justify-end border-t pt-4">
          <Button onClick={() => save.mutate(current)} disabled={save.isPending}>
            {save.isPending ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function SignatureImageInput({ signatureUrl, onChange }: { signatureUrl?: string; onChange: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File | null) {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Silakan pilih file gambar yang valid (JPG, PNG)")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 5MB")
      return
    }
    uploadFile(file, "certificate-signature")
      .promise.then((uploaded) => onChange(uploaded.url))
      .catch(() => toast.error("Gagal mengunggah gambar tanda tangan"))
  }

  return (
    <div className="space-y-1.5">
      <Label>Gambar Tanda Tangan (opsional)</Label>
      {signatureUrl ? (
        <div className="flex items-center gap-2">
          <img
            src={signatureUrl}
            alt="Tanda tangan"
            className="h-auto max-h-16 max-w-[160px] rounded-md bg-white object-contain p-1"
          />
          <Button size="sm" variant="ghost" onClick={() => onChange("")}>
            Hapus
          </Button>
        </div>
      ) : (
        <>
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            Unggah Gambar
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            className="hidden"
            onChange={(e) => {
              handleFile(e.target.files?.[0] ?? null)
              if (inputRef.current) inputRef.current.value = ""
            }}
          />
        </>
      )}
    </div>
  )
}
