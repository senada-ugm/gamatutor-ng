import { useState } from "react"
import { GraduationCap } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

/** Same atom as apps/app's: the box owns the sizing and a failed load
 *  falls back to it, so a dead thumbnail URL can't render a broken-image
 *  glyph or lay out at its own intrinsic size and overflow the grid. */
export function CourseThumbnail({
  thumbnail,
  className,
  placeholder = true,
}: {
  thumbnail?: string | null
  className?: string
  placeholder?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(thumbnail) && !failed

  if (!showImage && !placeholder) return null

  return (
    <div className={cn("relative overflow-hidden bg-muted", className ?? "size-full")} aria-hidden="true">
      {showImage ? (
        <img
          src={thumbnail ?? undefined}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted/60 text-muted-foreground/30">
          <GraduationCap className="size-6 stroke-[1.5] sm:size-7" />
        </div>
      )}
    </div>
  )
}
