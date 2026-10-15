import { useQuery } from "@tanstack/react-query"

import { apiGet } from "@/lib/api"
import { useSession } from "@/lib/session"
import type { ContractRegisteredInstitution } from "@workspace/contracts/domain"

/**
 * The institution this account works under — the single-tenant frontend's
 * replacement for the former authoring-scope switcher (PLANS Phase 5).
 *
 * Resolution: the account's first ownership grant; an admin holding no
 * grants falls back to the first registered institution (the platform's
 * one seeded tenant in practice). The backend's multi-tenant permission
 * model is untouched — this only decides what the UI shows, never what
 * the API allows.
 *
 * `undefined` while resolving (distinct from `null` = no institution), so
 * gates can avoid flashing an empty state at real owners during the
 * loading window.
 */
export interface ResolvedInstitution {
  id: string
  name: string
}

export function useMyInstitution(): ResolvedInstitution | null | undefined {
  const session = useSession()
  const user = session.data ?? null
  const isAdmin = user?.role === "admin"

  // Same query keys (and shapes) teaching-access.ts and the dashboard
  // already run, so navigation warms this cache for free.
  const ownerships = useQuery({
    queryKey: ["owned-institutions", user?.id],
    queryFn: () => apiGet<Array<{ institutionId: string }>>(`/institution-ownerships?userId=${user?.id}&pageSize=100`),
    enabled: user != null,
  })
  const institutions = useQuery({
    queryKey: ["institutions", "map"],
    queryFn: () => apiGet<ContractRegisteredInstitution[]>("/institutions?pageSize=100"),
    enabled: user != null,
  })

  if (!user || ownerships.isLoading || institutions.isLoading) return undefined

  const byId = new Map((institutions.data ?? []).map((i) => [i.id, i]))
  const firstOwned = (ownerships.data ?? []).map((o) => byId.get(o.institutionId)).find(Boolean)
  if (firstOwned) return { id: firstOwned.id, name: firstOwned.name }
  if (isAdmin) {
    const first = (institutions.data ?? [])[0]
    if (first) return { id: first.id, name: first.name }
  }
  return null
}
