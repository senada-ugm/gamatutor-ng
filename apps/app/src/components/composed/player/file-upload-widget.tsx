import { useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import { Progress } from "@workspace/ui/components/progress"

import { getUpload, uploadFile } from "@/lib/uploads"
import { formatFileSize } from "@/lib/lms-date"
import type { ContractAssignmentAttachment } from "@workspace/contracts/domain"

interface PendingUpload {
  id: string
  name: string
  progress: number
}

/**
 * Multi-file upload with real byte-level progress and validation
 * (type/size/count) against the assignment's constraints, using the
 * shared uploads service — same "upload first, submit the resulting id"
 * lifecycle as any other upload caller.
 */
export function FileUploadWidget({
  allowedFileTypes,
  maxFileSize,
  maxFiles,
  value,
  onChange,
  disabled,
}: {
  allowedFileTypes: string[]
  maxFileSize: number
  maxFiles: number
  value: ContractAssignmentAttachment[]
  onChange: (attachments: ContractAssignmentAttachment[]) => void
  disabled?: boolean
}) {
  const [pending, setPending] = useState<PendingUpload[]>([])
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const remainingSlots = maxFiles - value.length - pending.length

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)

    const incoming = Array.from(files).slice(0, Math.max(remainingSlots, 0))
    if (incoming.length < files.length) {
      setError(`Maksimum ${maxFiles} file. Beberapa file tidak ditambahkan.`)
    }

    for (const file of incoming) {
      if (allowedFileTypes.length > 0 && !allowedFileTypes.includes(file.type)) {
        setError(`Tipe file "${file.name}" tidak didukung.`)
        continue
      }
      if (file.size > maxFileSize) {
        setError(`File "${file.name}" melebihi ukuran maksimum ${formatFileSize(maxFileSize)}.`)
        continue
      }

      const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const handle = uploadFile(file, "assignment-submission", (fraction) => {
        setPending((prev) => prev.map((p) => (p.id === id ? { ...p, progress: Math.round(fraction * 100) } : p)))
      })
      setPending((prev) => [...prev, { id, name: file.name, progress: 0 }])

      handle.promise
        .then(async (uploaded) => {
          let meta = uploaded
          try {
            meta = await getUpload(uploaded.id)
          } catch {
            // Fall back to XHR response if getUpload fails
          }
          onChange([
            ...value,
            {
              uploadId: meta.id,
              url: meta.url,
              name: file.name,
              size: (meta as { sizeBytes?: number }).sizeBytes ?? file.size,
              mimeType: ((meta as { mimeType?: string }).mimeType ?? file.type) || "application/octet-stream",
            },
          ])
        })
        .catch(() => toast.error(`Gagal mengunggah "${file.name}"`))
        .finally(() => setPending((prev) => prev.filter((p) => p.id !== id)))
    }

    if (inputRef.current) inputRef.current.value = ""
  }

  function removeAttachment(uploadId: string) {
    onChange(value.filter((a) => a.uploadId !== uploadId))
  }

  const atLimit = remainingSlots <= 0

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        disabled={disabled || atLimit}
        accept={allowedFileTypes.join(",")}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || atLimit}
        onClick={() => inputRef.current?.click()}
        className="w-fit"
      >
        Unggah File
      </Button>
      <p className="text-xs text-muted-foreground">
        Maksimum {maxFiles} file, {formatFileSize(maxFileSize)} per file. {value.length + pending.length}/{maxFiles}{" "}
        digunakan.
      </p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {pending.map((p) => (
        <div key={p.id} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs">{p.name}</p>
            <Progress value={p.progress} className="h-1.5" />
          </div>
        </div>
      ))}

      {value.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {value.map((attachment) => (
            <li
              key={attachment.uploadId}
              className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5"
            >
              <span className="truncate text-sm">{attachment.name}</span>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={() => removeAttachment(attachment.uploadId)}
                  aria-label={`Hapus ${attachment.name}`}
                >
                  Hapus
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
