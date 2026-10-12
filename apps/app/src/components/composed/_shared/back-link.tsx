import { Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"

import { Button } from "@workspace/ui/components/button"

interface BackLinkProps {
  label?: string
  /** Route-target back navigation. */
  to?: Parameters<typeof Link>[0]["to"]
  params?: Record<string, string>
  /** Callback back navigation — component-local views without a route. */
  onClick?: () => void
}

/** The one back-button idiom across the app: the same ghost sm button
 *  PageHeader renders, arrow as an icon instead of a text glyph. */
export function BackLink({ label = "Kembali", to, params, onClick }: BackLinkProps) {
  const content = (
    <>
      <ArrowLeft /> {label}
    </>
  )
  if (to) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        nativeButton={false}
        render={<Link to={to} params={params} />}
      >
        {content}
      </Button>
    )
  }
  return (
    <Button variant="ghost" size="sm" className="w-fit" onClick={onClick}>
      {content}
    </Button>
  )
}
