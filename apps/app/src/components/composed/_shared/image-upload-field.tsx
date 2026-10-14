import { useRef, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"

import { formatFileSize } from "@/lib/lms-date"
import { uploadFile } from "@/lib/uploads"

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

/**
 * Upload-on-select image field — same lifecycle as course-form.tsx's
 * thumbnail field (upload immediately via the general uploads service,
 * hand the resulting URL back through onChange), pulled out here so a
 * second and third caller (institution logo, in registration + the
 * admin form) don't each re-implement it.
 */
export function ImageUploadField({
  id,
  label,
  purpose,
  value,
  onChange,
  preview,
  hint,
}: {
  id: string
  label: string
  purpose: string
  value: string
  onChange: (url: string) => void
  preview: React.ReactNode
  hint?: string
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar.")
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`Ukuran melebihi maksimum ${formatFileSize(MAX_IMAGE_BYTES)}.`)
      return
    }
    setError(null)
    setUploading(true)
    uploadFile(file, purpose)
      .promise.then((uploaded) => onChange(uploaded.url))
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal mengunggah gambar."))
      .finally(() => setUploading(false))
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-3">
        {preview}
        <div className="flex flex-col items-start gap-2">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? "Mengunggah..." : value ? "Ganti Gambar" : "Unggah Gambar"}
            </Button>
            {value ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
                Hapus
              </Button>
            ) : null}
          </div>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
