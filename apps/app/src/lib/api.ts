/**
 * Thin fetch wrapper for the LMS API. The generated hey-api SDK's path
 * interpolation is broken in this Vite setup (path params come out as
 * literal "{id}"), so every call goes through this helper instead —
 * one place for baseUrl, credentials, envelope unwrapping, and error
 * shaping. If the SDK is ever fixed, migrate back to it.
 */

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8010"

export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** GET — returns the envelope's `data` payload. */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}/v1${path}`, { credentials: "include" })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(body?.error?.message ?? `Request failed (${res.status})`, res.status)
  return (body?.data ?? null) as T
}

export interface PagedResult<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    totalPages: number
    totalCount: number
    hasNext: boolean
    hasPrevious: boolean
  }
}

/** GET a paged collection — rows plus the envelope's pagination block,
 *  so list pages can drive the shared Pager without guessing totals. */
export async function apiGetPaged<T>(path: string): Promise<PagedResult<T>> {
  const res = await fetch(`${API_URL}/v1${path}`, { credentials: "include" })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(body?.error?.message ?? `Request failed (${res.status})`, res.status)
  return {
    data: (body?.data ?? []) as T[],
    pagination: body?.pagination ?? {
      page: 1,
      pageSize: 0,
      totalPages: 1,
      totalCount: 0,
      hasNext: false,
      hasPrevious: false,
    },
  }
}

/** POST/PATCH/PUT/DELETE with a JSON body — returns the envelope's `data`. */
export async function apiSend<T>(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${API_URL}/v1${path}`, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const parsed = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(parsed?.error?.message ?? `Request failed (${res.status})`, res.status)
  return (parsed?.data ?? null) as T
}
