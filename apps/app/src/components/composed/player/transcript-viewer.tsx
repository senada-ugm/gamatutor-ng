import { useState } from "react"
import { ChevronDown, ChevronUp, FileText } from "lucide-react"

interface TranscriptViewerProps {
  transcript?: string
  title?: string
  defaultOpen?: boolean
  className?: string
}

export function TranscriptViewer({
  transcript,
  title = "Slide Narration Transcript",
  defaultOpen = false,
  className = "",
}: TranscriptViewerProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  if (!transcript || transcript.trim() === "") {
    return null
  }

  // Parse transcript paragraphs and bullet points
  const rawParagraphs = transcript.split(/\n\s*\n/).filter((p) => p.trim().length > 0)

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
          <span className="text-xs font-normal text-muted-foreground/80">
            ({rawParagraphs.length} {rawParagraphs.length === 1 ? "paragraph" : "paragraphs"})
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="space-y-3 border-t bg-background/60 px-4 py-3 text-sm leading-relaxed text-foreground/90">
          {rawParagraphs.map((para, pIdx) => {
            const lines = para
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean)
            const isBulletList = lines.every((l) => /^[•\-\*]|\d+\.\s/.test(l))

            if (isBulletList) {
              return (
                <ul key={pIdx} className="list-disc space-y-1.5 pl-5 text-foreground/90">
                  {lines.map((item, lIdx) => (
                    <li key={lIdx} className="pl-1">
                      {item.replace(/^[•\-\*]|\d+\.\s*/, "")}
                    </li>
                  ))}
                </ul>
              )
            }

            return (
              <p key={pIdx} className="text-foreground/85">
                {para}
              </p>
            )
          })}
        </div>
      )}
    </div>
  )
}
