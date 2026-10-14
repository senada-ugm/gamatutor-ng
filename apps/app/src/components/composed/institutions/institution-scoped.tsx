import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { EmptyState } from "@/components/composed/_shared/empty-state"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { ALL_INSTITUTIONS, useAuthoringScope } from "@/lib/authoring-institution"

/**
 * The three institution-level pages all need exactly one institution to
 * report on, which the sidebar's switcher may not currently be pointing
 * at — an admin's default scope is ALL_INSTITUTIONS, and an account that
 * owns nothing has no scope at all. Rather than each page inventing its
 * own guard, they wrap their body in this and receive a resolved id.
 */
export function InstitutionScoped({
  children,
}: {
  children: (institution: { id: string; name: string }) => React.ReactNode
}) {
  const scope = useAuthoringScope()

  if (scope.isLoading) return <Skeleton className="h-64 w-full" />
  if (scope.isError) return <ErrorState error={scope.error} onRetry={scope.refetch} />
  if (scope.institutions.length === 0) {
    return (
      <EmptyState
        title="Belum ada institusi"
        description="Halaman ini menampilkan data satu institusi. Ajukan institusi terlebih dahulu untuk mulai mengelolanya."
      />
    )
  }
  if (scope.scopeId === ALL_INSTITUTIONS || !scope.institution) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Pilih satu institusi</h2>
          <p className="text-sm text-muted-foreground">
            Laporan dan data ini dihitung per institusi. Pilih salah satu institusi di bawah ini untuk mengelolanya:
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scope.institutions.map((inst) => (
            <Card key={inst.id} className="flex flex-col justify-between transition-colors hover:border-primary/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-semibold text-primary">
                    {inst.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate text-base">{inst.name}</CardTitle>
                    {inst.address || inst.institutionType ? (
                      <CardDescription className="truncate text-xs">
                        {inst.address ?? inst.institutionType}
                      </CardDescription>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Button className="w-full" size="sm" variant="outline" onClick={() => scope.select(inst.id)}>
                  Kelola Institusi Ini
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }
  return <>{children({ id: scope.institution.id, name: scope.institution.name })}</>
}
