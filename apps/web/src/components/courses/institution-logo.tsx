import { useState } from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Institution logo — image or nothing (unlike CourseThumbnail's grid
 * placeholder, a missing logo next to inline text shouldn't render an
 * empty box; the institution name alone is enough). A failed load is
 * treated the same as a missing one, so a dead URL doesn't leave a
 * broken-image glyph beside the name.
 */
export function InstitutionLogo({ logo, className }: { logo?: string | null; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (!logo || failed) return null
  return (
    <div className={cn("relative overflow-hidden bg-muted", className ?? "size-full")} aria-hidden="true">
      <img
        src={logo}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="absolute inset-0 size-full object-cover"
      />
    </div>
  )
}
