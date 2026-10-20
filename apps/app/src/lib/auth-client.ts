import { createAuthClient } from "better-auth/react"
import { API_URL } from "@/lib/api"

/**
 * Better Auth client for apps/app. In a plain Vite SPA, the proxy-based
 * client works correctly (no SSR transform to break it). Same session
 * cookie as apps/legacy and apps/web — all hit the same apps/api.
 */
export const authClient = createAuthClient({
  baseURL: API_URL || window.location.origin,
  basePath: "/api/auth",
})
