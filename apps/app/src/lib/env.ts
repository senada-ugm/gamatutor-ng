/** Origin of the public marketing website (apps/web) —
 * unauthenticated visitors hitting the root route get redirected here. */
export const WEB_ORIGIN: string = (import.meta.env.VITE_WEB_ORIGIN as string | undefined) ?? "http://localhost:3020"
