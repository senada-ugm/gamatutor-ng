import { useQuery } from "@tanstack/react-query"
import { getSession } from "@/lib/auth"
import type { SessionUser } from "@/lib/auth"

export type { SessionUser }

/**
 * Reactive session hook backed by TanStack Query over the Better Auth client.
 */
export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    staleTime: 60_000,
  })
}
