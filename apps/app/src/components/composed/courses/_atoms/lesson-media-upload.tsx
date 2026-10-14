import { useRef, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Progress } from "@workspace/ui/components/progress"

import { deleteUpload, getUpload, uploadFile } from "@/lib/uploads"
import { formatFileSize } from "@/lib/lms-date"

/** Mirrors the server's per-purpose caps (uploads.service.ts) and the
 *  accept filters for each media lesson type. */
const MEDIA_RULES = {
  audio: { purpose: "audio", accept: "audio/*", maxBytes: 50 * 1024 * 1024, label: "Audio" },
  video: { purpose: "video", accept: "video/*", maxBytes: 200 * 1024 * 1024, label: "Video" },
  document: {
    purpose: "document",
    accept: ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx",
    maxBytes: 25 * 1024 * 1024,
    label: "Dokumen",
  },
} as const

/**
 * Single-file media picker for a lesson's `url` — same immediate-upload
 * lifecycle as the course thumbnail panel: upload on select with real
 * byte progress, `onChange(url)` only once the upload completes (never
 * optimistically), and a file this session created is deleted again if
 * the user replaces or removes it before the lesson form is saved. An
 * URL that came from an already-saved lesson is left alone — the
 * server-side release-on-update path reclaims it when Save lands.
 */
export function LessonMediaUpload({
  contentType,
  value,
  onChange,
  disabled,
}: {
  contentType: "audio" | "video" | "document"
  value: string
  onChange: (url: string) => void
  disabled?: boolean
}) {
  const rules = MEDIA_RULES[contentType]
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  /** Upload ids created by this component instance and still referenced
   *  by `value` — candidates for a pre-save delete when replaced. */
  const sessionUploadIds = useRef<Set<string>>(new Set())

  async function adopt(uploaded: { id: string; url: string }, name: string) {
    setFileName(name)
    sessionUploadIds.current.add(uploaded.id)
    onChange(uploaded.url)
    try {
      const meta = await getUpload(uploaded.id)
      if (meta.mimeType) setFileName(`${name}`)
    } catch {
      // Metadata is cosmetic here — the URL is already adopted.
    }
  }

  function handleFile(file: File | undefined) {
    if (!file || disabled) return
    if (file.size > rules.maxBytes) {
      setError(`File melebihi ukuran maksimum ${formatFileSize(rules.maxBytes)}.`)
      return
    }
    setError(null)
    setProgress(0)

    // A file this session uploaded and never saved gets deleted now that
    // it's being superseded; a loaded lesson's URL is the server's to
    // release on save.
    const previousId = value.match(/\/v1\/uploads\/(upl_[a-zA-Z0-9]+)\/file/)?.[1]
    if (previousId && sessionUploadIds.current.has(previousId)) {
      deleteUpload(previousId)
      sessionUploadIds.current.delete(previousId)
    }

    uploadFile(file, rules.purpose, (fraction) => setProgress(Math.round(fraction * 100)))
      .promise.then((uploaded) => void adopt(uploaded, file.name))
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal mengunggah file."))
      .finally(() => setProgress(null))

    if (inputRef.current) inputRef.current.value = ""
  }

  function clear() {
    const previousId = value.match(/\/v1\/uploads\/(upl_[a-zA-Z0-9]+)\/file/)?.[1]
    if (previousId && sessionUploadIds.current.has(previousId)) {
      deleteUpload(previousId)
      sessionUploadIds.current.delete(previousId)
    }
    setFileName(null)
    setError(null)
    onChange("")
  }

  const displayName = fileName ?? (value ? decodeURIComponent(value.split("/").pop() ?? "") : null)

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        disabled={disabled || progress !== null}
        accept={rules.accept}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || progress !== null}
          onClick={() => inputRef.current?.click()}
        >
          {progress !== null ? "Mengunggah..." : value ? `Ganti ${rules.label}` : `Unggah ${rules.label}`}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={clear}>
            Hapus
          </Button>
        ) : null}
        <p className="text-xs text-muted-foreground">
          PDF/PPT/Word, MP4/WebM, atau MP3 — maks {formatFileSize(rules.maxBytes)}.
        </p>
      </div>
      {progress !== null ? <Progress value={progress} className="h-1.5 max-w-64" /> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {displayName && progress === null ? (
        <p className="truncate rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground">{displayName}</p>
      ) : null}
    </div>
  )
}
