import { useState } from "react"
import { ArrowRight, CheckCircle, Info, Volume2 } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import type { HotspotPage } from "@/lib/content/course-types"

interface SequentialHotspotViewerProps {
  page: HotspotPage
  onStepComplete?: (stepIndex: number) => void
  onAllCompleted?: () => void
  className?: string
}

export function SequentialHotspotViewer({
  page,
  onStepComplete,
  onAllCompleted,
  className = "",
}: SequentialHotspotViewerProps) {
  const [currentStep, setCurrentStep] = useState<number>(0)
  const [visited, setVisited] = useState<Record<number, boolean>>({ 0: true })

  function handleSelectStep(idx: number) {
    setCurrentStep(idx)
    const nextVisited = { ...visited, [idx]: true }
    setVisited(nextVisited)
    onStepComplete?.(idx)

    if (Object.keys(nextVisited).length === page.points.length) {
      onAllCompleted?.()
    }
  }

  function handleAdvance() {
    if (currentStep < page.points.length - 1) {
      handleSelectStep(currentStep + 1)
    }
  }

  function handleSpeak(text: string) {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = "id-ID"
      window.speechSynthesis.speak(u)
    }
  }

  const activePoint = page.points[currentStep]
  const isLastStep = currentStep === page.points.length - 1
  const allCompleted = Object.keys(visited).length === page.points.length

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Explicit Guidance Banner (Review #4) */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 text-primary shrink-0 mt-0.5">
            <Info className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground">
                Sequential Pathophysiology Flow (Steps 1 → 8)
              </span>
              <Badge variant="outline" className="text-xs bg-background">
                Step {currentStep + 1} of {page.points.length}
              </Badge>
              {allCompleted && (
                <Badge variant="outline" className="text-xs bg-teal-50 text-teal-800 border-teal-300">
                  All Steps Explored
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Please click the numbered hotspots sequentially (1 through 8) to trace the microvascular progression
              from chronic hyperglycemia to severe proliferative neovascularization.
            </p>
          </div>
        </div>

        {/* Step Progress Nodes */}
        <div className="mt-3 flex items-center justify-between gap-1 overflow-x-auto pt-2 border-t border-primary/10">
          {page.points.map((pt, idx) => {
            const isCompleted = !!visited[idx]
            const isCurrent = currentStep === idx
            const isNext = idx === currentStep + 1

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectStep(idx)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                  isCurrent
                    ? "bg-primary text-primary-foreground shadow-xs scale-105"
                    : isCompleted
                      ? "bg-teal-500/15 text-teal-800 dark:text-teal-300 hover:bg-teal-500/25"
                      : isNext
                        ? "border border-primary/40 text-primary bg-primary/5 animate-pulse"
                        : "text-muted-foreground hover:bg-muted/50"
                }`}
                title={`Step ${idx + 1}: ${pt.label}`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                    isCurrent ? "bg-white text-primary" : "bg-black/10"
                  }`}
                >
                  {idx + 1}
                </span>
                <span className="hidden sm:inline truncate max-w-[80px]">{pt.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Stage & Detail Panel */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Hotspot Image Stage */}
        <div className="lg:col-span-8 flex flex-col items-center">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-xl border bg-black/5 shadow-inner select-none">
            <img
              src={page.image}
              alt={page.title}
              className="w-full h-auto object-contain block"
              loading="eager"
            />

            {/* Masks */}
            {page.masks?.map((mask, mIdx) => (
              <div
                key={`mask-${mIdx}`}
                className="absolute pointer-events-none rounded-xs border border-white/20 bg-white/10"
                style={{
                  left: `${mask.x}%`,
                  top: `${mask.y}%`,
                  width: `${mask.w}%`,
                  height: `${mask.h}%`,
                }}
              />
            ))}

            {/* Hotspot Pins with Animated Pulse on Next Required Step */}
            {page.points.map((point, pIdx) => {
              const isCurrent = currentStep === pIdx
              const isCompleted = !!visited[pIdx]
              const isNextRecommended = pIdx === currentStep + 1

              return (
                <button
                  key={`seq-pin-${pIdx}`}
                  type="button"
                  onClick={() => handleSelectStep(pIdx)}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full text-xs font-bold transition-all duration-300 cursor-pointer ${
                    isCurrent
                      ? "h-8 w-8 bg-primary text-primary-foreground ring-4 ring-primary/40 shadow-xl scale-125 z-30"
                      : isNextRecommended
                        ? "h-7 w-7 bg-amber-500 text-white ring-4 ring-amber-400/60 animate-pulse shadow-md hover:scale-110 z-20"
                        : isCompleted
                          ? "h-6 w-6 bg-teal-600 text-white ring-2 ring-white/70 hover:scale-105 z-10"
                          : "h-6 w-6 bg-slate-700 text-white ring-1 ring-white/50 hover:bg-slate-900 z-10"
                  }`}
                  style={{
                    left: `${point.x}%`,
                    top: `${point.y}%`,
                  }}
                  title={`Step ${pIdx + 1}: ${point.label}`}
                  aria-label={`Step ${pIdx + 1}: ${point.label}`}
                >
                  {pIdx + 1}
                </button>
              )
            })}
          </div>
        </div>

        {/* Clinical Detail Card */}
        <div className="lg:col-span-4 space-y-3">
          {activePoint && (
            <div className="rounded-xl border bg-card p-5 shadow-xs space-y-4">
              <div className="flex items-start justify-between gap-2 border-b pb-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-bold text-primary">
                      CASCADE STEP #{currentStep + 1} OF {page.points.length}
                    </span>
                    {visited[currentStep] && (
                      <Badge variant="outline" className="text-[10px] text-teal-700 border-teal-300 bg-teal-50">
                        Visited
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-foreground leading-snug mt-0.5">{activePoint.label}</h3>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                  onClick={() => handleSpeak(`${activePoint.label}. ${activePoint.body}`)}
                  title="Listen to clinical rationale"
                >
                  <Volume2 className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-sm leading-relaxed text-foreground/85">{activePoint.body}</p>

              {/* Advance CTA */}
              <div className="pt-2 border-t">
                {!isLastStep ? (
                  <Button
                    onClick={handleAdvance}
                    className="w-full gap-2 shadow-sm"
                  >
                    <span>Proceed to Step {currentStep + 2}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <div className="rounded-lg bg-teal-500/10 border border-teal-500/20 p-3 text-center text-xs text-teal-800 dark:text-teal-300">
                    <CheckCircle className="h-4 w-4 mx-auto mb-1 text-teal-600" />
                    <strong>Cascade Complete!</strong> You have reviewed the complete microvascular pathophysiology
                    progression.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
