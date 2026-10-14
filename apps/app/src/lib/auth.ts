import { authClient } from "./auth-client"

export interface SessionUser {
  id: string
  name: string
  email: string
  role: "user" | "admin"
}

/**
 * Auth helpers using the Better Auth client. In a plain Vite SPA (no SSR,
 * no hydration), the client's proxy-based API works correctly — the
 * issues we hit in TanStack Start were SSR/hydration boundary problems
 * that don't exist here.
 */

export async function signIn(email: string, password: string): Promise<SessionUser | null> {
  const { data, error } = await authClient.signIn.email({ email, password })
  if (error || !data) return null
  return data.user as unknown as SessionUser
}

export async function signOut(): Promise<void> {
  await authClient.signOut()
}

export async function getSession(): Promise<SessionUser | null> {
  const { data, error } = await authClient.getSession()
  if (error || !data) return null
  return (data.user ?? null) as unknown as SessionUser | null
}

export async function signUp(name: string, email: string, password: string): Promise<boolean> {
  const { error } = await authClient.signUp.email({ name, email, password })
  return !error
}
