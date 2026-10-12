import { createServerFn } from "@tanstack/react-start"

import { VITE_API_URL } from "./env"

/**
 * Public server functions for the marketing site's SSR loaders. All
 * data here is public (published courses, institution names, the public
 * certificate registry) — no cookie forwarding, because nothing on
 * apps/web is authenticated anymore; the handoff to the SPA carries
 * the session instead.
 */

/** Fetch published courses for the catalog/landing, optionally filtered
 *  by text search across title and short description. */
export const getServerCourses = createServerFn({ method: "GET" })
  .validator((input: unknown) => input as { status: string; pageSize: number; search?: string })
  // @ts-expect-error — TanStack Start v1.168 type inference issue with
  // validator+handler chains; runtime is correct.
  .handler(async ({ data }) => {
    const params = new URLSearchParams({ status: data.status, pageSize: String(data.pageSize) })
    if (data.search) params.set("search", data.search)
    const res = await fetch(`${VITE_API_URL}/v1/courses?${params}`)
    if (res.status >= 500) throw new Error("Gagal memuat katalog pelatihan.")
    if (!res.ok) return []
    const body = await res.json()
    return (body?.data ?? []) as Array<Record<string, unknown>>
  })

/** Fetch a course by id (published content is public). */
export const getServerCourse = createServerFn({ method: "GET" })
  .validator((courseId: string) => courseId)
  .handler(async ({ data: courseId }) => {
    const res = await fetch(`${VITE_API_URL}/v1/courses/${courseId}`)
    if (res.status >= 500) throw new Error("Gagal memuat detail pelatihan.")
    if (!res.ok) return null
    const body = await res.json()
    return body?.data ?? null
  })

/** Fetch an institution name by id (public). */
export const getServerInstitution = createServerFn({ method: "GET" })
  .validator((institutionId: string) => institutionId)
  .handler(async ({ data: institutionId }) => {
    const res = await fetch(`${VITE_API_URL}/v1/institutions/${institutionId}`)
    if (!res.ok) return null
    const body = await res.json()
    return body?.data ?? null
  })

/** Public certificate lookup by verification code or number — backs
 *  the public verify page. */
export const getServerCertificateVerify = createServerFn({ method: "GET" })
  .validator((code: string) => code)
  .handler(async ({ data: code }) => {
    const res = await fetch(`${VITE_API_URL}/v1/certificates/verify?code=${encodeURIComponent(code)}`)
    if (res.status >= 500) throw new Error("Gagal memeriksa sertifikat.")
    if (!res.ok) return null
    const body = await res.json()
    return body?.data ?? null
  })
