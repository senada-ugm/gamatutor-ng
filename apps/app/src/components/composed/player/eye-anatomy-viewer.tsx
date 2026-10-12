import { useState } from "react"
import { Eye, Info, Volume2, Box, Layers, CheckCircle2 } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import type { HotspotPage, HotspotPoint } from "@/lib/content/course-types"

interface EyeAnatomyViewerProps {
  page: HotspotPage
  mode?: "2d" | "3d"
  onModeChange?: (mode: "2d" | "3d") => void
  onPointSelect?: (index: number, point: HotspotPoint) => void
  className?: string
}

export function EyeAnatomyViewer({
  page,
  mode = "2d",
  onModeChange,
  onPointSelect,
  className = "",
}: EyeAnatomyViewerProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(0)
  const [visited, setVisited] = useState<Record<number, boolean>>({ 0: true })
  const [currentMode, setCurrentMode] = useState<"2d" | "3d">(mode)

  function handleSelectPoint(idx: number) {
    setActiveIdx(idx)
    setVisited((prev) => ({ ...prev, [idx]: true }))
    onPointSelect?.(idx, page.points[idx])
  }

  function handleSpeak(text: string) {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = "id-ID"
      window.speechSynthesis.speak(u)
    }
  }

  const activePoint = activeIdx !== null ? page.points[activeIdx] : null
  const visitedCount = Object.keys(visited).length
  const totalCount = page.points.length

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header and 2D/3D Mode Switcher (Pluggable Slot) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
              {page.kicker || "ANATOMY"}
            </Badge>
            <h2 className="text-xl font-bold tracking-tight">{page.title}</h2>
          </div>
          {page.intro ? <p className="mt-1 text-sm text-muted-foreground">{page.intro}</p> : null}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
            <Button
              type="button"
              size="sm"
              variant={currentMode === "2d" ? "default" : "ghost"}
              className="h-7 gap-1.5 px-2.5 text-xs"
              onClick={() => {
                setCurrentMode("2d")
                onModeChange?.("2d")
              }}
            >
              <Layers className="h-3.5 w-3.5" />
              2D Diagram
            </Button>
            <Button
              type="button"
              size="sm"
              variant={currentMode === "3d" ? "default" : "ghost"}
              className="h-7 gap-1.5 px-2.5 text-xs"
              onClick={() => {
                setCurrentMode("3d")
                onModeChange?.("3d")
              }}
              title="WebGL 3D Interactive Model (Extensible Architecture)"
            >
              <Box className="h-3.5 w-3.5" />
              3D Model
              <span className="font-mono text-[10px] opacity-80">(Beta)</span>
            </Button>
          </div>
        </div>
      </div>

      {currentMode === "3d" ? (
        /* Future 3D WebGL Canvas Slot */
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-primary/30 bg-muted/20 p-12 text-center">
          <div className="mb-3 rounded-full bg-primary/10 p-4 text-primary">
            <Box className="h-8 w-8 animate-spin" />
          </div>
          <h3 className="text-lg font-semibold">3D WebGL Anatomy Canvas Slot</h3>
          <p className="mt-1 mb-4 max-w-md text-sm text-muted-foreground">
            The system architecture is decoupled and ready to mount Three.js / WebGL canvas models without refactoring
            the page layout or data contracts.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setCurrentMode("2d")
              onModeChange?.("2d")
            }}
          >
            Switch back to 2D High-Resolution Diagram
          </Button>
        </div>
      ) : (
        /* 2D Interactive Stage */
        <div className="grid items-start gap-6 lg:grid-cols-12">
          <div className="flex flex-col items-center lg:col-span-8">
            <div className="relative w-full max-w-2xl overflow-hidden rounded-xl border bg-black/5 shadow-inner select-none">
              <img src={page.image} alt={page.title} className="block h-auto w-full object-contain" loading="eager" />

              {/* Render Mask Areas if defined */}
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

              {/* Interactive Hotspot Pins */}
              {page.points.map((point, pIdx) => {
                const isActive = activeIdx === pIdx
                const isPointVisited = !!visited[pIdx]

                return (
                  <button
                    key={`pin-${pIdx}`}
                    type="button"
                    onClick={() => handleSelectPoint(pIdx)}
                    className={`absolute flex -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-xs font-bold transition-all duration-200 ${
                      isActive
                        ? "z-20 h-7 w-7 scale-110 bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/40"
                        : isPointVisited
                          ? "z-10 h-6 w-6 bg-teal-600 text-white ring-2 ring-white/60 hover:scale-105"
                          : "z-10 h-6 w-6 bg-slate-800 text-white ring-2 ring-white/80 hover:scale-105 hover:bg-primary"
                    }`}
                    style={{
                      left: `${point.x}%`,
                      top: `${point.y}%`,
                    }}
                    title={point.label}
                    aria-label={`Hotspot pin ${pIdx + 1}: ${point.label}`}
                    aria-pressed={isActive}
                  >
                    {pIdx + 1}
                  </button>
                )
              })}
            </div>

            <div className="mt-2 flex w-full items-center justify-between px-1 text-xs text-muted-foreground">
              <span>Click on any numbered point to explore anatomical details</span>
              <span className="font-medium text-foreground">
                Explored: {visitedCount} / {totalCount}
              </span>
            </div>
          </div>

          {/* Structure Detail Sidebar */}
          <div className="space-y-3 lg:col-span-4">
            {activePoint ? (
              <div className="space-y-3 rounded-xl border bg-card p-5 shadow-xs">
                <div className="flex items-start justify-between gap-2 border-b pb-3">
                  <div>
                    <span className="font-mono text-xs font-medium text-primary">
                      STRUCTURE #{(activeIdx ?? 0) + 1}
                    </span>
                    <h3 className="text-lg leading-snug font-bold text-foreground">{activePoint.label}</h3>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                    onClick={() => handleSpeak(`${activePoint.label}. ${activePoint.body}`)}
                    title="Listen to description"
                  >
                    <Volume2 className="h-4 w-4" />
                  </Button>
                </div>

                <p className="text-sm leading-relaxed text-foreground/85">{activePoint.body}</p>

                {/* DR Relevance highlight */}
                {activePoint.label.toLowerCase().includes("retina") ||
                activePoint.label.toLowerCase().includes("fovea") ||
                activePoint.label.toLowerCase().includes("makula") ||
                activePoint.label.toLowerCase().includes("arteri") ? (
                  <div className="flex items-start gap-2 rounded-lg border border-teal-500/20 bg-teal-500/10 p-2.5 text-xs text-teal-800 dark:text-teal-300">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                    <span>
                      <strong>Clinical Relevance:</strong> Critical landmark for Diabetic Retinopathy screening and
                      fundus evaluation.
                    </span>
                  </div>
                ) : null}

                <div className="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 font-medium text-teal-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Explored
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      disabled={activeIdx === 0}
                      onClick={() => handleSelectPoint((activeIdx ?? 1) - 1)}
                    >
                      Prev
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      disabled={activeIdx === totalCount - 1}
                      onClick={() => handleSelectPoint((activeIdx ?? 0) + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                <Eye className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
                Select any anatomical point on the left diagram to view details.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
