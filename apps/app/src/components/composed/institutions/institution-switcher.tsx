import { Check, ChevronsUpDown } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"

import { ALL_INSTITUTIONS, useAuthoringScope } from "@/lib/authoring-institution"

const ALL_LABEL = "Semua institusi"

/**
 * The authoring scope picker. Renders nothing when there is nothing to
 * pick — one institution and no platform-wide option is not a choice,
 * and a dropdown with a single entry is a lie about the shape of the
 * data. Callers that need to state the scope regardless (the create
 * form, which has to say where the course will land) read
 * `useAuthoringScope()` directly.
 */
export function InstitutionSwitcher({
  className,
  /** Full-width two-line block for the sidebar header; the default is a
   *  compact control that sits in a page header's action row. */
  block = false,
}: {
  className?: string
  block?: boolean
}) {
  const scope = useAuthoringScope()

  if (scope.isLoading) return null

  // With nothing to switch between, the compact control has no reason to
  // exist — but the sidebar still has to say which institution the
  // console is scoped to, so the block form degrades to a static label
  // rather than vanishing. A static label is not a control lying about
  // its options.
  if (!scope.hasChoice) {
    if (!block || !scope.institution) return null
    return (
      <div className={cn("rounded-lg border px-3 py-2", className)}>
        <p className="truncate text-sm font-medium">{scope.institution.name}</p>
        <p className="truncate text-xs text-muted-foreground">{scope.institution.institutionType ?? "Institusi"}</p>
      </div>
    )
  }

  const label = scope.scopeId === ALL_INSTITUTIONS ? ALL_LABEL : (scope.institution?.name ?? "Pilih institusi")
  const sublabel =
    scope.scopeId === ALL_INSTITUTIONS ? "Seluruh platform" : (scope.institution?.institutionType ?? "Institusi")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          block ? (
            <Button
              variant="outline"
              className={cn("h-auto w-full justify-between gap-2 px-3 py-2 text-start", className)}
            />
          ) : (
            <Button variant="outline" size="sm" className={cn("max-w-56 justify-between gap-2", className)} />
          )
        }
      >
        {block ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{label}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">{sublabel}</span>
          </span>
        ) : (
          <span className="truncate">{label}</span>
        )}
        <ChevronsUpDown className="shrink-0 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={block ? "start" : "end"} className="w-auto min-w-64">
        {scope.canSelectAll ? (
          <>
            <ScopeItem
              label={ALL_LABEL}
              description="Seluruh pelatihan di platform"
              selected={scope.scopeId === ALL_INSTITUTIONS}
              onSelect={() => scope.select(ALL_INSTITUTIONS)}
            />
            <DropdownMenuSeparator />
          </>
        ) : null}
        {/* Base UI throws "MenuGroupContext is missing" on a label
            outside its group — the label is only legal in here. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Institusi</DropdownMenuLabel>
          {scope.institutions.map((institution) => (
            <ScopeItem
              key={institution.id}
              label={institution.name}
              description={institution.email ?? institution.institutionType}
              selected={scope.scopeId === institution.id}
              onSelect={() => scope.select(institution.id)}
            />
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ScopeItem({
  label,
  description,
  selected,
  onSelect,
}: {
  label: string
  description?: string | null
  selected: boolean
  onSelect: () => void
}) {
  return (
    <DropdownMenuItem onClick={onSelect} className="gap-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{label}</p>
        {description ? <p className="truncate text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Check className={cn("shrink-0", selected ? "opacity-100" : "opacity-0")} />
    </DropdownMenuItem>
  )
}
