import { useEffect, useState } from "react"
import { Play, Pause, Eye, RotateCcw, CheckCircle2 } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import type { RevealStep } from "@/lib/content/course-types"

interface AnimatedRevealListProps {
  steps: RevealStep[]
  intro?: string
  autoPlayIntervalMs?: number
  onComplete?: () => void
  className?: string
}

export function AnimatedRevealList({
  steps,
  intro,
  autoPlayIntervalMs = 1200,
  onComplete,
  className = "",
}: AnimatedRevealListProps) {
  // Start with at least 1 or 2 steps visible, or let user auto-play
  const [revealedCount, setRevealedCount] = useState<number>(2)
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(true)

  const totalSteps = steps.length
  const isAllRevealed = revealedCount >= totalSteps

  useEffect(() => {
    if (!isAutoPlaying || isAllRevealed) return

    const timer = window.setInterval(() => {
      setRevealedCount((prev) => {
        const next = prev + 1
        if (next >= totalSteps) {
          setIsAutoPlaying(false)
          onComplete?.()
          return totalSteps
        }
        return next
      })
    }, autoPlayIntervalMs)

    return () => window.clearInterval(timer)
  }, [isAutoPlaying, isAllRevealed, totalSteps, autoPlayIntervalMs, onComplete])

  function handleRevealAll() {
    setRevealedCount(totalSteps)
    setIsAutoPlaying(false)
    onComplete?.()
  }

  function handleReset() {
    setRevealedCount(1)
    setIsAutoPlaying(true)
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Intro and Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
        <div>
          {intro ? <p className="text-sm font-semibold text-foreground">{intro}</p> : null}
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Revealed: {Math.min(revealedCount, totalSteps)} of {totalSteps} items
            </span>
            {isAllRevealed && (
              <Badge variant="outline" className="border-teal-300 bg-teal-500/10 text-[10px] text-teal-800">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                All Displayed
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!isAllRevealed && (
            <Button
              size="sm"
              variant={isAutoPlaying ? "secondary" : "outline"}
              onClick={() => setIsAutoPlaying(!isAutoPlaying)}
              className="h-8 gap-1.5 text-xs"
            >
              {isAutoPlaying ? (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  Pause Auto Reveal
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Resume Auto Reveal
                </>
              )}
            </Button>
          )}

          {!isAllRevealed ? (
            <Button size="sm" variant="outline" onClick={handleRevealAll} className="h-8 gap-1.5 text-xs">
              <Eye className="h-3.5 w-3.5" />
              Reveal All (Skip)
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleReset}
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Replay Animation
            </Button>
          )}
        </div>
      </div>

      {/* 2-Column Responsive Grid (Reviews #5 & #6) */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {steps.map((step, idx) => {
          const isRevealed = idx < revealedCount
          if (!isRevealed) return null

          if ("texts" in step) {
            return (
              <div
                key={idx}
                className="group relative flex animate-in items-start gap-3 rounded-xl border bg-card p-4 shadow-xs transition-all duration-300 fade-in slide-in-from-bottom-2 hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  {String.fromCharCode(97 + idx)}
                </div>
                <div className="flex-1 space-y-1">
                  {step.texts.map((t, tIdx) => (
                    <p key={tIdx} className="text-sm leading-snug font-medium text-foreground">
                      {t.replace(/^[a-z]\.\s*/, "")}
                    </p>
                  ))}
                </div>
              </div>
            )
          }

          if ("image" in step) {
            return (
              <div
                key={idx}
                className="animate-in overflow-hidden rounded-xl border bg-card shadow-xs fade-in slide-in-from-bottom-2"
              >
                <img src={step.image} alt={step.title || ""} className="h-auto w-full object-cover" />
                {step.title || step.body ? (
                  <div className="p-3">
                    {step.title && <h4 className="text-sm font-semibold">{step.title}</h4>}
                    {step.body && <p className="mt-1 text-xs text-muted-foreground">{step.body}</p>}
                  </div>
                ) : null}
              </div>
            )
          }

          return null
        })}
      </div>
    </div>
  )
}
