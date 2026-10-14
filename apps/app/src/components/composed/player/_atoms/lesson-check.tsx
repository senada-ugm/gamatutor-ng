import { Check } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

/** The lesson done/pending bullet shared by the player sidebar and the
 *  Materi index — a small circle that fills primary with a check icon
 *  once the lesson is complete. */
export function LessonCheck({ done, className }: { done: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border",
        done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30",
        className
      )}
    >
      {done ? <Check className="size-3" strokeWidth={3} /> : null}
    </span>
  )
}
