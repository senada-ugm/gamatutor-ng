import { useState } from "react"
import { ChevronDown, ChevronUp, FileText } from "lucide-react"

interface TranscriptViewerProps {
  transcript?: string
  title?: string
  defaultOpen?: boolean
  className?: string
}

const BULLET = /^[•\-*]\s*/
const NUMBERED = /^(\d+)[.)]\s+/

type Block = { kind: "p"; text: string } | { kind: "ul" | "ol"; items: string[] }

/**
 * The narration script as readable text (DRIVE review, 29 Okt 2026):
 * blank lines separate paragraphs, and a single line break inside one —
 * the scripts put each enumerated point ("Kriteria pertama, …") on its
 * own line — starts a new paragraph too instead of running on. Runs of
 * "•"/"-" lines become a bullet list and "1." lines a numbered list.
 * Paragraph text is justified.
 */
function toBlocks(transcript: string): Block[] {
  const blocks: Block[] = []
  for (const para of transcript.split(/\n\s*\n/)) {
    for (const line of para.split("\n").map((l) => l.trim())) {
      if (!line) continue
      const kind = NUMBERED.test(line) ? "ol" : BULLET.test(line) ? "ul" : "p"
      if (kind === "p") {
        blocks.push({ kind, text: line })
        continue
      }
      const item = line.replace(kind === "ol" ? NUMBERED : BULLET, "")
      const last = blocks[blocks.length - 1]
      if (last && last.kind === kind) last.items.push(item)
      else blocks.push({ kind, items: [item] })
    }
  }
  return blocks
}

export function TranscriptViewer({
  transcript,
  title = "Transkrip Narasi",
  defaultOpen = false,
  className = "",
}: TranscriptViewerProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  if (!transcript || transcript.trim() === "") {
    return null
  }

  const blocks = toBlocks(transcript)

  return (
    <div className={`overflow-hidden rounded-lg border bg-muted/20 transition-all ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-left text-sm font-medium transition-colors select-none hover:bg-muted/40"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileText className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground/90">{title}</span>
          <span className="text-xs font-normal text-muted-foreground/80">({blocks.length} paragraf)</span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="space-y-3 border-t bg-background/60 px-4 py-3 text-sm leading-relaxed text-foreground/85">
          {blocks.map((block, i) =>
            block.kind === "p" ? (
              <p key={i} className="text-justify hyphens-auto" lang="id">
                {block.text}
              </p>
            ) : block.kind === "ol" ? (
              <ol key={i} className="list-decimal space-y-1.5 ps-5 text-justify">
                {block.items.map((item, j) => (
                  <li key={j} className="ps-1">
                    {item}
                  </li>
                ))}
              </ol>
            ) : (
              <ul key={i} className="list-disc space-y-1.5 ps-5 text-justify">
                {block.items.map((item, j) => (
                  <li key={j} className="ps-1">
                    {item}
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      )}
    </div>
  )
}
