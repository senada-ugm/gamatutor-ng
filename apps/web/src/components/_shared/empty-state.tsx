import { cn } from "@workspace/ui/lib/utils"

interface EmptyStateProps {
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  compact?: boolean
  className?: string
}

/** Same empty-slot idiom as apps/app's, so an empty catalog looks the
 *  same on the marketing site as it does inside the product. */
export function EmptyState({ title, description, action, compact = false, className }: EmptyStateProps) {
  return (
    <div className={cn("rounded-lg border border-dashed text-center", compact ? "px-4 py-6" : "px-6 py-10", className)}>
      <p className={cn("font-medium", compact ? "text-sm" : "text-base")}>{title}</p>
      {description ? <div className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
