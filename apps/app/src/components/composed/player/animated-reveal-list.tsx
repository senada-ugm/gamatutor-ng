import { useEffect, useState } from "react"
import { Play, Pause, Eye, RotateCcw, CheckCircle2 } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import type { RevealStep } from "@/lib/content/course-types"

interface AnimatedRevealListProps {
  steps: RevealStep[]
  intro?: string
  currentTime?: number
  autoPlayIntervalMs?: number
  columns?: 2 | 3
  onComplete?: () => void
  className?: string
}

export function AnimatedRevealList({
  steps,
  intro,
  currentTime,
  autoPlayIntervalMs = 1200,
  columns = 2,
  onComplete,
  className = "",
}: AnimatedRevealListProps) {
  const hasCues = steps.some((s) => s.cue !== undefined)
  const [timerCount, setRevealedCount] = useState<number>(2)
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(!hasCues)
  const [showAll, setShowAll] = useState<boolean>(false)

  const totalSteps = steps.length

  // With cues the narration drives the list, so replaying or scrubbing it
  // rewinds the list too. The first step is always shown: audio can be
  // blocked until the learner interacts, and the slide must not sit empty.
  let cueCount = 1
  for (let i = 0; i < totalSteps; i++) {
    const cue = steps[i]?.cue
    if (cue !== undefined && cue <= (currentTime ?? 0)) cueCount = i + 1
  }
  const revealedCount = showAll ? totalSteps : hasCues ? cueCount : timerCount
  const isAllRevealed = revealedCount >= totalSteps

  useEffect(() => {
    // If cues are present and audio is driving, don't run the blind interval timer
    if (hasCues || !isAutoPlaying || isAllRevealed) return

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
  }, [hasCues, isAutoPlaying, isAllRevealed, totalSteps, autoPlayIntervalMs, onComplete])

  function handleRevealAll() {
    setShowAll(true)
    setRevealedCount(totalSteps)
    setIsAutoPlaying(false)
    onComplete?.()
  }

  function handleReset() {
    setShowAll(false)
    setRevealedCount(1)
    setIsAutoPlaying(true)
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Intro and Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3 sm:min-h-[58px]">
        <div>
          {intro ? <p className="text-sm font-semibold text-foreground">{intro}</p> : null}
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Ditampilkan: {Math.min(revealedCount, totalSteps)} dari {totalSteps} poin
            </span>
            {isAllRevealed && (
              <Badge variant="outline" className="border-teal-300 bg-teal-500/10 text-[10px] text-teal-800">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Semua Ditampilkan
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!isAllRevealed && !hasCues && (
            <Button
              size="sm"
              variant={isAutoPlaying ? "secondary" : "outline"}
              onClick={() => setIsAutoPlaying(!isAutoPlaying)}
              className="h-8 gap-1.5 text-xs"
            >
              {isAutoPlaying ? (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  Jeda
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Lanjutkan
                </>
              )}
            </Button>
          )}

          {!isAllRevealed ? (
            <Button size="sm" variant="outline" onClick={handleRevealAll} className="h-8 gap-1.5 text-xs">
              <Eye className="h-3.5 w-3.5" />
              Tampilkan Semua
            </Button>
          ) : hasCues && !showAll ? null : (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleReset}
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Ulangi Animasi
            </Button>
          )}
        </div>
      </div>

      {/* 2-Column Responsive Grid (Reviews #5 & #6) */}
      <div className={`grid grid-cols-1 gap-3 ${columns === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {steps.map((step, idx) => {
          const isRevealed = idx < revealedCount
          // Narration-driven cards hold their place while hidden, so whatever
          // sits below the list (a photo, the transcript) never jumps.
          if (!isRevealed && !hasCues) return null
          const entrance = isRevealed ? "animate-in fade-in slide-in-from-bottom-2" : "invisible"
          // An odd last card sits centred under the pair above it, not left.
          const lone =
            columns === 2 && totalSteps % 2 === 1 && idx === totalSteps - 1
              ? "md:col-span-2 md:mx-auto md:w-[calc(50%-0.375rem)]"
              : ""

          if ("texts" in step) {
            return (
              <div
                key={idx}
                className={`group relative flex items-start gap-3 rounded-xl border bg-card p-4 shadow-xs transition-all duration-300 hover:border-primary/40 hover:shadow-sm ${entrance} ${lone}`}
              >
                {step.title ? null : (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    {String.fromCharCode(97 + idx)}
                  </div>
                )}
                <div className="flex-1 space-y-1">
                  {step.title ? <h4 className="text-sm font-bold text-primary">{step.title}</h4> : null}
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
              <div key={idx} className={`overflow-hidden rounded-xl border bg-card shadow-xs ${entrance} ${lone}`}>
                <img src={step.image} alt={step.title || ""} className="h-60 w-full bg-white object-contain" />
                {step.title || step.body ? (
                  <div className="p-3">
                    {step.title && <h4 className="text-sm font-semibold">{step.title}</h4>}
                    {step.body && <p className="mt-1 text-xs text-muted-foreground">{step.body}</p>}
                  </div>
                ) : null}
              </div>
            )
          }

          if ("video" in step) {
            return (
              <div
                key={idx}
                className="animate-in overflow-hidden rounded-xl border bg-black/90 shadow-xs fade-in slide-in-from-bottom-2 md:col-span-2"
              >
                <video
                  src={step.video.src}
                  poster={step.video.poster}
                  controls
                  className="max-h-[420px] w-full rounded-xl object-contain"
                />
                {step.narration && (
                  <div className="border-t bg-card p-3">
                    <p className="text-xs text-muted-foreground">{step.narration}</p>
                  </div>
                )}
              </div>
            )
          }

          return null
        })}
      </div>
    </div>
  )
}
