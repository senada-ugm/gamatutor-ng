import { cn } from "@workspace/ui/lib/utils"

interface EmptyStateProps {
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  /** Tighter box for an empty slot nested inside a card or a panel,
   *  where the page-level padding would dwarf its surroundings. */
  compact?: boolean
  className?: string
}

/** The one empty-slot idiom. Sized down from the original `p-12` /
 *  `text-lg font-semibold`: an empty list is the least important thing
 *  on a page and shouldn't be the biggest box on it. */
export function EmptyState({ title, description, action, compact = false, className }: EmptyStateProps) {
  return (
    <div className={cn("rounded-lg border border-dashed text-center", compact ? "px-4 py-6" : "px-6 py-10", className)}>
      <p className={cn("font-medium", compact ? "text-sm" : "text-base")}>{title}</p>
      {description ? <div className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
