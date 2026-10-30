import { useState } from "react"
import { BookOpen, ChevronDown, ChevronUp, ListChecks } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * The slide's Daftar Referensi and Daftar Singkatan, as two boxes side by
 * side under the narration bar (Referensi left, Singkatan right) whose
 * contents open on click — the layout agreed with the DRIVE team on
 * 29 Okt 2026. A box only renders when the slide has entries for it.
 */
export function ReferenceBoxes({ references, abbreviations }: { references?: string[]; abbreviations?: string[] }) {
  const hasRefs = !!references?.length
  const hasAbbr = !!abbreviations?.length
  if (!hasRefs && !hasAbbr) return null

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {hasRefs ? (
        <Box icon={<BookOpen className="size-4 text-primary" />} title="Daftar Referensi" count={references.length}>
          <ol className="list-decimal space-y-1.5 ps-5">
            {references.map((ref, i) => (
              <li key={i} className="ps-1 break-words">
                {ref}
              </li>
            ))}
          </ol>
        </Box>
      ) : (
        <div className="hidden sm:block" />
      )}
      {hasAbbr ? (
        <Box
          icon={<ListChecks className="size-4 text-primary" />}
          title="Daftar Singkatan"
          count={abbreviations.length}
        >
          <dl className="space-y-1">
            {abbreviations.map((entry, i) => {
              const cut = entry.indexOf(",")
              return cut > 0 ? (
                <div key={i} className="flex gap-2">
                  <dt className="shrink-0 font-semibold text-foreground">{entry.slice(0, cut)}</dt>
                  <dd>{entry.slice(cut + 1).trim()}</dd>
                </div>
              ) : (
                <div key={i}>{entry}</div>
              )
            })}
          </dl>
        </Box>
      ) : null}
    </div>
  )
}

function Box({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode
  title: string
  count: number
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={cn("self-start overflow-hidden rounded-lg border bg-muted/20", open && "bg-background")}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition-colors select-none hover:bg-muted/40"
      >
        <span className="flex items-center gap-2">
          {icon}
          <span className="font-semibold text-foreground/90">{title}</span>
          <span className="text-xs text-muted-foreground/80">({count})</span>
        </span>
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>
      {open ? (
        <div className="max-h-64 overflow-y-auto border-t px-4 py-3 text-xs leading-relaxed text-foreground/85">
          {children}
        </div>
      ) : null}
    </div>
  )
}
