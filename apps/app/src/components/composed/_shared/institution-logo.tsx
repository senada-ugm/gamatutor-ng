import { useState } from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Institution logo — image, a muted placeholder box, or nothing.
 * `placeholder` defaults to false: next to inline text (a course card
 * crediting its provider) a missing logo should just be absent, not an
 * empty box — but a form's own upload preview wants the box, so it can
 * pass `placeholder`. Same shape as CourseThumbnail, including its
 * load-failure fallback: a dead logo URL sat inline next to the
 * institution name as a broken-image glyph on every card.
 */
export function InstitutionLogo({
  logo,
  className,
  placeholder = false,
}: {
  logo?: string | null
  className?: string
  placeholder?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(logo) && !failed

  if (!showImage && !placeholder) return null

  return (
    <div className={cn("relative overflow-hidden bg-muted", className ?? "size-full")} aria-hidden="true">
      {showImage ? (
        <img
          src={logo ?? undefined}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
    </div>
  )
}
