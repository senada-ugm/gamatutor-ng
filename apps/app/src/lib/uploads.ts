import { API_V1 } from "@/lib/api"

export interface UploadedFile {
  id: string
  url: string
}

export interface UploadHandle {
  promise: Promise<UploadedFile>
  cancel: () => void
}

/**
 * Uploads a file immediately via XMLHttpRequest — not the generated
 * `uploadsApiCreate` SDK function, which is fetch-based and has no
 * upload-progress events. `xhr.upload.onprogress` is what gives real
 * byte-level progress, which callers show live. Must NOT set a
 * Content-Type header manually — the browser sets its own multipart
 * boundary. Field order matters to the server's multipart parser
 * (apps/api/src/modules/uploads/routes/uploads.routes.ts): send
 * `purpose` before `file`.
 */
export function uploadFile(file: File, purpose: string, onProgress?: (fraction: number) => void): UploadHandle {
  const xhr = new XMLHttpRequest()

  const promise = new Promise<UploadedFile>((resolve, reject) => {
    xhr.open("POST", `${API_V1}/uploads`)
    xhr.withCredentials = true

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total)
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText) as { data: UploadedFile }
          resolve({ id: body.data.id, url: body.data.url })
        } catch {
          reject(new Error("Respons server tidak valid"))
        }
        return
      }
      let message = "Gagal mengunggah file"
      try {
        const body = JSON.parse(xhr.responseText) as { error?: { message?: string } }
        message = body.error?.message ?? message
      } catch {
        // Non-JSON error body (e.g. a proxy timeout page) — keep the default message.
      }
      reject(new Error(message))
    }

    xhr.onerror = () => reject(new Error("Gagal mengunggah file — periksa koneksi Anda"))
    xhr.onabort = () => reject(new DOMException("Upload dibatalkan", "AbortError"))

    const formData = new FormData()
    formData.append("purpose", purpose)
    formData.append("file", file)
    xhr.send(formData)
  })

  return { promise, cancel: () => xhr.abort() }
}

/** Explicit cancel for an upload that was already stored but never ended
 *  up referenced by a saved entity (e.g. the user picked a different
 *  file, or removed it, before submitting the surrounding form). Fires
 *  and forgets — a failure here just means the orphan sweep cleans it up
 *  later instead of immediately, so callers don't need to handle errors. */
export function deleteUpload(id: string): void {
  void fetch(`${API_V1}/uploads/${id}`, { method: "DELETE", credentials: "include" }).catch(() => {
    // Best-effort — the background orphan sweep is the backstop.
  })
}

/** Fetch metadata for a stored upload. */
export async function getUpload(id: string): Promise<UploadedFile & { sizeBytes?: number; mimeType?: string }> {
  const res = await fetch(`${API_V1}/uploads/${id}`, { credentials: "include" })
  if (!res.ok) throw new Error("Gagal mengambil metadata file")
  const json = (await res.json()) as { data: UploadedFile & { sizeBytes?: number; mimeType?: string } }
  return json.data
}
