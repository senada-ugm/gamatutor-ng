import { BackLink } from "@/components/composed/_shared/back-link"
import { cn } from "@workspace/ui/lib/utils"

interface PageHeaderProps {
  title?: React.ReactNode
  description?: React.ReactNode
  backTo?: Parameters<typeof BackLink>[0]["to"]
  backParams?: Record<string, string>
  backLabel?: string
  actions?: React.ReactNode
  className?: string
}

/** The one page header, matched field-for-field to apps/web's so a
 *  visitor crossing from the marketing site into the app doesn't see the
 *  same heading rendered at a different weight and tracking. */
export function PageHeader({
  title,
  description,
  backTo,
  backParams,
  backLabel = "Kembali",
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {backTo && <BackLink to={backTo} params={backParams} label={backLabel} />}
      {title || actions ? (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            {title ? <h1 className="text-2xl font-semibold tracking-tight">{title}</h1> : null}
            {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
    </div>
  )
}
