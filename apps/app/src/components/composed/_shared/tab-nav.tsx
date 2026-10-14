import { useEffect, useRef } from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * The one tab-bar idiom for section chrome. The admin section, the
 * course editor's twelve tabs, and the player header each hand-rolled
 * the same `flex gap-1 overflow-x-auto border-b pb-2` nav with a
 * `bg-muted` active pill — which reads as "a button someone is
 * hovering", not "the tab you are on". A single underline sitting on
 * the bar's own border says it instead, at less visual weight.
 *
 * The scroller is real: twelve editor tabs never fit a phone, and the
 * old markup let them overflow their header instead of scrolling
 * (a flex item won't shrink below its content without `min-w-0`).
 * On mount the active tab is scrolled into view, so a deep link never
 * lands on a bar that looks like nothing is selected.
 */
export function TabNav({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    ref.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [])

  return (
    <nav
      ref={ref}
      className={cn(
        "flex min-w-0 gap-1 overflow-x-auto border-b [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {children}
    </nav>
  )
}

/**
 * Props for one tab inside a TabNav — spread onto a router `Link` so the
 * call site keeps TanStack's typed `to`/`params` checking.
 */
export function tabNavItemProps(active: boolean) {
  return {
    "aria-current": active ? ("page" as const) : undefined,
    className: cn(
      "relative shrink-0 rounded-t-md px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-colors outline-none",
      "focus-visible:ring-3 focus-visible:ring-ring/50",
      "after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors",
      active
        ? "font-semibold text-[#0369a1] after:bg-[#0284c7] dark:text-sky-300 dark:after:bg-sky-400"
        : "text-muted-foreground after:bg-transparent hover:text-foreground"
    ),
  }
}
