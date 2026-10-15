import { Skeleton } from "@workspace/ui/components/skeleton"

import { EmptyState } from "@/components/composed/_shared/empty-state"
import { useMyInstitution } from "@/lib/institution-ownership"

/**
 * The two institution-level pages (overview, participants) need exactly
 * one institution to report on. In the single-tenant frontend that is
 * simply the account's resolved institution (PLANS Phase 5) — no scope
 * picker, no "all institutions" listing mode.
 */
export function InstitutionScoped({
  children,
}: {
  children: (institution: { id: string; name: string }) => React.ReactNode
}) {
  const institution = useMyInstitution()

  if (institution === undefined) return <Skeleton className="h-64 w-full" />
  if (institution === null) {
    return (
      <EmptyState
        title="Belum ada institusi"
        description="Halaman ini menampilkan data satu institusi. Hubungi admin platform untuk mendapatkan akses institusi Anda."
      />
    )
  }
  return <>{children({ id: institution.id, name: institution.name })}</>
}
