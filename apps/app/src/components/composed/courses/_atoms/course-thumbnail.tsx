import { useState } from "react"
import { GraduationCap } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Course cover image — one atom shared by every surface that represents
 * a course (browse lists, wishlist, dashboard, editor), so the "image or
 * muted placeholder" decision lives in one place instead of being
 * re-implemented per page. `placeholder` controls whether a missing
 * thumbnail renders a muted slot (list rows/grids, where every item must
 * line up) or nothing at all (a single detail page, where an empty box
 * would just be dead space).
 *
 * The image is absolutely positioned inside a box that owns the sizing,
 * and a load failure falls back to that box. A bare `<img>` here meant a
 * dead thumbnail URL rendered the browser's broken-image glyph AND, on a
 * one-column grid, laid out at the broken image's intrinsic size — which
 * pushed the card wider than the viewport and gave the whole catalog a
 * horizontal scrollbar on a phone.
 */
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
