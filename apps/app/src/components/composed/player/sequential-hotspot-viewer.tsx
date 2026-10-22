import { useEffect, useRef, useState } from "react"
import { ArrowRight, CheckCircle, Info, Volume2 } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import type { HotspotPage, HotspotPoint } from "@/lib/content/course-types"
import { speak } from "@/lib/speech"

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
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  function handleSelectStep(idx: number) {
    setCurrentStep(idx)
    const nextVisited = { ...visited, [idx]: true }
    setVisited(nextVisited)
    onStepComplete?.(idx)
    handleSpeak(page.points[idx])

    if (Object.keys(nextVisited).length === page.points.length) {
      onAllCompleted?.()
    }
  }

  function handleAdvance() {
    if (currentStep < page.points.length - 1) {
      handleSelectStep(currentStep + 1)
    }
  }

  function handleSpeak(point: HotspotPoint) {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
    }

    if (point.audio && typeof window !== "undefined") {
      const audio = new Audio(point.audio)
      audioRef.current = audio
      audio.play().catch(() => {
        fallbackSpeak(`${point.label}. ${point.body}`)
      })
      return
    }

    fallbackSpeak(`${point.label}. ${point.body}`)
  }

  function fallbackSpeak(text: string) {
    speak(text)
  }

  const activePoint = page.points[currentStep]
  const isLastStep = currentStep === page.points.length - 1
  const allCompleted = Object.keys(visited).length === page.points.length

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Explicit Guidance Banner (Review #4) */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0 rounded-full bg-primary/10 p-2 text-primary">
            <Info className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              Alur Patofisiologi Berurutan (Langkah 1 → {page.points.length})
            </span>
            <Badge variant="outline" className="bg-background text-xs">
              Langkah {currentStep + 1} dari {page.points.length}
            </Badge>
            {allCompleted && (
              <Badge variant="outline" className="border-teal-300 bg-teal-50 text-xs text-teal-800">
                Semua Langkah Telah Dipelajari
              </Badge>
            )}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Silakan klik nomor secara berurutan 1–{page.points.length} untuk mengetahui patofisiologi retinopati
            diabetika dari hiperglikemia kronik hingga neovaskularisasi proliferatif.
          </p>
        </div>

        {/* Step Progress Nodes */}
        <div className="mt-3 flex items-center justify-between gap-1 overflow-x-auto border-t border-primary/10 pt-2">
          {page.points.map((pt, idx) => {
            const isCompleted = !!visited[idx]
            const isCurrent = currentStep === idx
            const isNext = idx === currentStep + 1

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectStep(idx)}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-all ${
                  isCurrent
                    ? "scale-105 bg-primary text-primary-foreground shadow-xs"
                    : isCompleted
                      ? "bg-teal-500/15 text-teal-800 hover:bg-teal-500/25 dark:text-teal-300"
                      : isNext
                        ? "animate-pulse border border-primary/40 bg-primary/5 text-primary"
                        : "text-muted-foreground hover:bg-muted/50"
                }`}
                title={`Langkah ${idx + 1}: ${pt.label}`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                    isCurrent ? "bg-white text-primary" : "bg-black/10"
                  }`}
                >
                  {idx + 1}
                </span>
                <span className="hidden max-w-[80px] truncate sm:inline">{pt.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Stage & Detail Panel */}
      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* Hotspot Image Stage */}
        <div className="flex flex-col items-center lg:col-span-8">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-xl border bg-black/5 shadow-inner select-none">
            <img src={page.image} alt={page.title} className="block h-auto w-full object-contain" loading="eager" />

            {/* Masks */}
            {page.masks?.map((mask, mIdx) => (
              <div
                key={`mask-${mIdx}`}
                className="pointer-events-none absolute rounded-xs border border-white/20 bg-white/10"
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
                  className={`absolute flex -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                    isCurrent
                      ? "z-30 h-8 w-8 scale-125 bg-primary text-primary-foreground shadow-xl ring-4 ring-primary/40"
                      : isNextRecommended
                        ? "z-20 h-7 w-7 animate-pulse bg-amber-500 text-white shadow-md ring-4 ring-amber-400/60 hover:scale-110"
                        : isCompleted
                          ? "z-10 h-6 w-6 bg-teal-600 text-white ring-2 ring-white/70 hover:scale-105"
                          : "z-10 h-6 w-6 bg-slate-700 text-white ring-1 ring-white/50 hover:bg-slate-900"
                  }`}
                  style={{
                    left: `${point.x}%`,
                    top: `${point.y}%`,
                  }}
                  title={`Langkah ${pIdx + 1}: ${point.label}`}
                  aria-label={`Langkah ${pIdx + 1}: ${point.label}`}
                >
                  {pIdx + 1}
                </button>
              )
            })}
          </div>
        </div>

        {/* Clinical Detail Card */}
        <div className="space-y-3 lg:col-span-4">
          {activePoint && (
            <div className="space-y-4 rounded-xl border bg-card p-5 shadow-xs">
              <div className="flex items-start justify-between gap-2 border-b pb-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold text-primary">
                      TAHAP KASKADE #{currentStep + 1} DARI {page.points.length}
                    </span>
                    {visited[currentStep] && (
                      <Badge variant="outline" className="border-teal-300 bg-teal-50 text-[10px] text-teal-700">
                        Sudah Dipelajari
                      </Badge>
                    )}
                  </div>
                  <h3 className="mt-0.5 text-lg leading-snug font-bold text-foreground">{activePoint.label}</h3>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                  onClick={() => handleSpeak(activePoint)}
                  title="Dengarkan penjelasan klinis"
                >
                  <Volume2 className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-sm leading-relaxed text-foreground/85">{activePoint.body}</p>

              {/* Advance CTA */}
              <div className="border-t pt-2">
                {!isLastStep ? (
                  <Button onClick={handleAdvance} className="w-full gap-2 shadow-sm">
                    <span>Lanjut ke Langkah {currentStep + 2}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <div className="rounded-lg border border-teal-500/20 bg-teal-500/10 p-3 text-center text-xs text-teal-800 dark:text-teal-300">
                    <CheckCircle className="mx-auto mb-1 h-4 w-4 text-teal-600" />
                    <strong>Kaskade Lengkap!</strong> Anda telah mempelajari seluruh perkembangan patofisiologi
                    retinopati diabetika.
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
