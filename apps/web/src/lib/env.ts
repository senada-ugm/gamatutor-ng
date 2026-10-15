/** Public env access — Vite inlines these at build time. */
export const VITE_API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8010"

/** Origin of the authenticated SPA (apps/app) — every "Masuk/Daftar"
 *  CTA on this marketing site hands off there. */
export const APP_ORIGIN: string = (import.meta.env.VITE_APP_ORIGIN as string | undefined) ?? "http://localhost:3030"
