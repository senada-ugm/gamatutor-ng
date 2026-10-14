import { useCallback, useSyncExternalStore } from "react"
import { useQuery } from "@tanstack/react-query"

import { apiGet } from "@/lib/api"
import { useSession } from "@/lib/session"
import type { ContractRegisteredInstitution } from "@workspace/contracts/domain"

/**
 * Which institution the signed-in account is currently authoring under.
 *
 * `institution_ownerships` is a join table with a unique index on
 * (user_id, institution_id) — one account can own many institutions, and
 * the API has always allowed that. The UI had no concept of a "current"
 * one, so `/instructor/courses/new` read `ownerships[0]` and every new
 * course silently landed in whichever institution the API happened to
 * return first, with nothing on screen saying which. This module is that
 * missing concept: a scope the user picks, sees, and can change.
 *
 * Admins are scoped differently — they may author under any registered
 * institution and their course list is platform-wide, so they also get
 * ALL_INSTITUTIONS, which is the listing scope but never a create target.
 */

/** Sentinel scope: an admin looking at every institution at once. */
export const ALL_INSTITUTIONS = "all"

const STORAGE_KEY = "lms.authoring-institution"

/** The stored id is always validated against the account's own list
 *  before use, so a stale id left by a different account on a shared
 *  browser resolves to that account's default rather than leaking a
 *  scope it has no access to. That check is what makes a per-user
 *  storage key unnecessary. */
function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    // Private windows and blocked site data throw on access.
    return null
  }
}

const listeners = new Set<() => void>()
let snapshot: string | null = null
let snapshotLoaded = false

function getSnapshot(): string | null {
  if (!snapshotLoaded) {
    snapshot = readStored()
    snapshotLoaded = true
  }
  return snapshot
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

function setStored(id: string): void {
  snapshot = id
  snapshotLoaded = true
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // Selection still applies for this session; it just won't persist.
  }
  listeners.forEach((listener) => listener())
}

export interface AuthoringScope {
  /** Institutions this account may author under, name-sorted. */
  institutions: ContractRegisteredInstitution[]
  /** The active scope: an institution id, or ALL_INSTITUTIONS for an admin. */
  scopeId: string | null
  /** The active institution, or null when the scope is ALL_INSTITUTIONS. */
  institution: ContractRegisteredInstitution | null
  /** Whether ALL_INSTITUTIONS is offered (admins only). */
  canSelectAll: boolean
  /** True once a real choice exists to make — drives whether to render a picker. */
  hasChoice: boolean
  select: (id: string) => void
  isLoading: boolean
  isError: boolean
  error: unknown
  refetch: () => void
}

interface OwnershipRow {
  institutionId: string
}

export function useAuthoringScope(): AuthoringScope {
  const session = useSession()
  const user = session.data ?? null
  const isAdmin = user?.role === "admin"

  // Admins may author under any institution; everyone else only under
  // the ones they own.
  const ownerships = useQuery({
    queryKey: ["owned-institutions", user?.id],
    queryFn: () => apiGet<OwnershipRow[]>(`/institution-ownerships?userId=${user?.id}&pageSize=100`),
    enabled: user != null && !isAdmin,
  })

  const all = useQuery({
    queryKey: ["institutions", "authoring"],
    queryFn: () => apiGet<ContractRegisteredInstitution[]>("/institutions?pageSize=100"),
    enabled: user != null,
  })

  const ownedIds = new Set((ownerships.data ?? []).map((row) => row.institutionId))
  const institutions = (all.data ?? [])
    .filter((institution) => isAdmin || ownedIds.has(institution.id))
    .sort((a, b) => a.name.localeCompare(b.name))

  const stored = useSyncExternalStore(subscribe, getSnapshot, () => null)

  // Resolution order: a stored scope that is still valid for this
  // account, then the account's default. An admin defaults to the
  // platform-wide view they had before this scope existed; an owner
  // defaults to their first institution.
  const storedIsValid =
    stored != null && ((stored === ALL_INSTITUTIONS && isAdmin) || institutions.some((i) => i.id === stored))
  const fallback = isAdmin ? ALL_INSTITUTIONS : (institutions[0]?.id ?? null)
  const scopeId = storedIsValid ? stored : fallback

  const select = useCallback((id: string) => setStored(id), [])

  return {
    institutions,
    scopeId,
    institution: institutions.find((i) => i.id === scopeId) ?? null,
    canSelectAll: !!isAdmin,
    hasChoice: institutions.length > 1 || (!!isAdmin && institutions.length > 0),
    select,
    isLoading: all.isLoading || ownerships.isLoading,
    isError: all.isError || ownerships.isError,
    error: all.error ?? ownerships.error,
    refetch: () => {
      void all.refetch()
      void ownerships.refetch()
    },
  }
}
