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
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">
              Revealed: {Math.min(revealedCount, totalSteps)} of {totalSteps} items
            </span>
            {isAllRevealed && (
              <Badge variant="outline" className="text-[10px] bg-teal-500/10 text-teal-800 border-teal-300">
                <CheckCircle2 className="h-3 w-3 mr-1" />
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
              className="h-8 text-xs gap-1.5"
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
            <Button
              size="sm"
              variant="outline"
              onClick={handleRevealAll}
              className="h-8 text-xs gap-1.5"
            >
              <Eye className="h-3.5 w-3.5" />
              Reveal All (Skip)
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleReset}
              className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Replay Animation
            </Button>
          )}
        </div>
      </div>

      {/* 2-Column Responsive Grid (Reviews #5 & #6) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {steps.map((step, idx) => {
          const isRevealed = idx < revealedCount
          if (!isRevealed) return null

          if ("texts" in step) {
            return (
              <div
                key={idx}
                className="group relative flex items-start gap-3 rounded-xl border bg-card p-4 shadow-xs transition-all duration-300 hover:border-primary/40 hover:shadow-sm animate-in fade-in slide-in-from-bottom-2"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  {String.fromCharCode(97 + idx)}
                </div>
                <div className="flex-1 space-y-1">
                  {step.texts.map((t, tIdx) => (
                    <p key={tIdx} className="text-sm font-medium leading-snug text-foreground">
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
                className="rounded-xl border bg-card overflow-hidden shadow-xs animate-in fade-in slide-in-from-bottom-2"
              >
                <img src={step.image} alt={step.title || ""} className="w-full h-auto object-cover" />
                {step.title || step.body ? (
                  <div className="p-3">
                    {step.title && <h4 className="font-semibold text-sm">{step.title}</h4>}
                    {step.body && <p className="text-xs text-muted-foreground mt-1">{step.body}</p>}
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
