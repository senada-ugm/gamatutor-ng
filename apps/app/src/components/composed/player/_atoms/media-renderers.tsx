import { useEffect, useState } from "react"
import { Download, FileAudio, FileText } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { getUpload } from "@/lib/uploads"
import { formatFileSize } from "@/lib/lms-date"

const UPLOAD_URL_PATTERN = /\/v1\/uploads\/(upl_[a-zA-Z0-9]+)\/file/

/** A lesson's audio: the browser's native player against the lesson URL
 *  (an uploads byte URL or an external audio link). */
export function AudioLessonPlayer({ url, title }: { url: string; title: string }) {
  return (
    <div className="flex max-w-2xl flex-col items-start gap-3 rounded-xl border bg-muted/30 p-5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <FileAudio className="size-4 text-primary" />
        <span className="truncate">{title}</span>
      </div>
      <audio controls src={url} className="w-full" preload="metadata">
        Browser Anda tidak mendukung pemutar audio.
      </audio>
    </div>
  )
}

interface DocumentMeta {
  /** The file's server-sniffed MIME type, when the URL is an upload. */
  mimeType?: string
  sizeBytes?: number
  originalFilename?: string
}

/** A lesson's document: PDFs render inline in the browser's own viewer
 *  (an `<iframe>` against the byte URL — no client-side PDF pipeline);
 *  everything else (PPT, Word, Excel) renders as a download card, since
 *  browsers download rather than display those formats anyway. */
export function DocumentLessonViewer({ url, title }: { url: string; title: string }) {
  const [meta, setMeta] = useState<DocumentMeta | null>(null)
  const [loading, setLoading] = useState(false)

  const uploadId = url.match(UPLOAD_URL_PATTERN)?.[1]

  useEffect(() => {
    if (!uploadId) return
    setLoading(true)
    getUpload(uploadId)
      .then((m) =>
        setMeta({
          mimeType: (m as { mimeType?: string }).mimeType,
          sizeBytes: (m as { sizeBytes?: number }).sizeBytes,
          originalFilename: undefined,
        })
      )
      .catch(() => setMeta({}))
      .finally(() => setLoading(false))
  }, [uploadId])

  if (loading) {
    return <Skeleton className="h-96 w-full rounded-xl" />
  }

  const isPdf = meta?.mimeType === "application/pdf" || (!uploadId && /\.pdf(\?|$)/i.test(url))
  if (isPdf) {
    return (
      <div className="space-y-2">
        <div className="overflow-hidden rounded-xl border bg-white shadow-xs">
          <iframe src={url} title={title} className="h-[75vh] w-full border-0">
            Browser Anda tidak mendukung pratinjau PDF.
          </iframe>
        </div>
        <a href={url} download target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="size-4" />
            Unduh PDF
          </Button>
        </a>
      </div>
    )
  }

  const displayName = meta?.originalFilename ?? decodeURIComponent(url.split("/").pop() ?? title)
  return (
    <div className="flex max-w-md flex-col items-start gap-3 rounded-xl border bg-muted/30 p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10">
          <FileText className="size-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{displayName}</p>
          {meta?.sizeBytes ? <p className="text-xs text-muted-foreground">{formatFileSize(meta.sizeBytes)}</p> : null}
        </div>
      </div>
      <a href={url} download target="_blank" rel="noreferrer" className="w-full">
        <Button className="w-full gap-2">
          <Download className="size-4" />
          Unduh Dokumen
        </Button>
      </a>
      <p className="text-xs text-muted-foreground">
        Dokumen PowerPoint/Word dibuka di aplikasi office setelah diunduh.
      </p>
    </div>
  )
}
