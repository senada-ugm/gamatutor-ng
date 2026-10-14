import { createAuthClient } from "better-auth/react"

/**
 * Better Auth client for apps/app. In a plain Vite SPA, the proxy-based
 * client works correctly (no SSR transform to break it). Same session
 * cookie as apps/legacy and apps/web — all hit the same apps/api.
 */
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
  basePath: "/api/auth",
})
