import { useState } from "react"
import { CheckCircle2, XCircle, ArrowRight, Eye, ZoomIn, ZoomOut } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import type { ImageGradingPage } from "@/lib/content/course-types"

interface ClinicalFundusGradingProps {
  page: ImageGradingPage
  onGraded?: (isCorrect: boolean, selected: string) => void
  onNext?: () => void
  className?: string
}

export function ClinicalFundusGrading({
  page,
  onGraded,
  onNext,
  className = "",
}: ClinicalFundusGradingProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false)
  const [showLesions, setShowLesions] = useState<boolean>(true)
  const [isZoomed, setIsZoomed] = useState<boolean>(false)

  const isCorrect = selectedOption === page.correct

  function handleSelect(option: string) {
    if (isSubmitted) return
    setSelectedOption(option)
  }

  function handleSubmit() {
    if (!selectedOption) return
    setIsSubmitted(true)
    onGraded?.(selectedOption === page.correct, selectedOption)
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
            SIMULATION • {page.level || "CLINICAL GRADING"}
          </Badge>
          <h2 className="text-xl font-bold tracking-tight">Fundus Photography Clinical Evaluation</h2>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            onClick={() => setIsZoomed(!isZoomed)}
          >
            {isZoomed ? <ZoomOut className="h-3.5 w-3.5" /> : <ZoomIn className="h-3.5 w-3.5" />}
            {isZoomed ? "Reset Scale" : "Zoom 1.5x"}
          </Button>

          {isSubmitted && page.lesions.length > 0 && (
            <Button
              size="sm"
              variant={showLesions ? "secondary" : "outline"}
              className="h-8 text-xs gap-1.5"
              onClick={() => setShowLesions(!showLesions)}
            >
              <Eye className="h-3.5 w-3.5" />
              {showLesions ? "Hide Lesion Pins" : "Show Lesion Pins"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Fundus Examination Stage */}
        <div className="lg:col-span-8 flex flex-col items-center">
          <div
            className={`relative w-full max-w-2xl overflow-hidden rounded-2xl border bg-black shadow-lg select-none transition-transform duration-300 ${
              isZoomed ? "scale-125 z-20 cursor-move" : ""
            }`}
          >
            <img
              src={page.image}
              alt="High-resolution retinal fundus photograph"
              className="w-full h-auto object-contain block max-h-[500px]"
              loading="eager"
            />

            {/* Non-Obscuring SVG Lesion Pointer Arrows (Review #7) */}
            {isSubmitted && showLesions && page.lesions.length > 0 && (
              <div className="absolute inset-0 pointer-events-none">
                {page.lesions.map((lesion, idx) => {
                  // Determine offset positioning so label doesn't cover lesion
                  const isUpperHalf = lesion.y < 50
                  const isLeftHalf = lesion.x < 50

                  // Offset label by 38px
                  const labelOffsetY = isUpperHalf ? -40 : 40
                  const labelOffsetX = isLeftHalf ? -30 : 30

                  return (
                    <div
                      key={idx}
                      className="absolute"
                      style={{
                        left: `${lesion.x}%`,
                        top: `${lesion.y}%`,
                      }}
                    >
                      {/* SVG Target Reticle and Pointer Arrow */}
                      <svg
                        className="overflow-visible absolute"
                        style={{
                          left: 0,
                          top: 0,
                          width: 1,
                          height: 1,
                        }}
                      >
                        <defs>
                          <marker
                            id={`arrow-${idx}`}
                            viewBox="0 0 10 10"
                            refX="5"
                            refY="5"
                            markerWidth="6"
                            markerHeight="6"
                            orient="auto-start-reverse"
                          >
                            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444" />
                          </marker>
                        </defs>

                        {/* Lesion Ring - doesn't obscure the center lesion */}
                        <circle
                          cx="0"
                          cy="0"
                          r="9"
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="2.5"
                          strokeDasharray="3 2"
                          className="animate-pulse"
                        />

                        {/* Arrow line from offset label to target center */}
                        <line
                          x1={labelOffsetX}
                          y1={labelOffsetY}
                          x2={labelOffsetX > 0 ? 9 : -9}
                          y2={labelOffsetY > 0 ? 9 : -9}
                          stroke="#ef4444"
                          strokeWidth="2"
                          markerEnd={`url(#arrow-${idx})`}
                        />
                      </svg>

                      {/* Offset Label Badge */}
                      <div
                        className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900/95 text-white px-2 py-0.5 text-[11px] font-semibold tracking-wide border border-red-500 shadow-md backdrop-blur-xs"
                        style={{
                          left: `${labelOffsetX}px`,
                          top: `${labelOffsetY}px`,
                        }}
                      >
                        {lesion.label}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="w-full flex items-center justify-between text-xs text-muted-foreground mt-2 px-1">
            <span>Standard 45° macular-centered fundus view</span>
            {isSubmitted && page.lesions.length > 0 && (
              <span className="text-red-500 font-medium">
                {page.lesions.length} verified lesion landmarks indicated
              </span>
            )}
          </div>
        </div>

        {/* Diagnostic Options & Rationale Panel */}
        <div className="lg:col-span-4 space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">Clinical Diagnostic Options:</h3>
            <p className="text-xs text-muted-foreground">
              Select the appropriate diagnosis for this patient based on the retinal microvascular findings.
            </p>
          </div>

          <div className="space-y-2.5">
            {page.options.map((opt, idx) => {
              const isSelected = selectedOption === opt

              let btnBorder = "border-border hover:border-primary/60 bg-card"
              if (isSelected && !isSubmitted) {
                btnBorder = "border-primary bg-primary/10 ring-2 ring-primary/40 font-semibold"
              } else if (isSubmitted) {
                if (opt === page.correct) {
                  // Correct answer: Vivid green styling
                  btnBorder =
                    "border-emerald-500 bg-emerald-500/15 text-emerald-900 dark:text-emerald-300 font-bold ring-2 ring-emerald-500/30"
                } else if (isSelected && !isCorrect) {
                  // Incorrect answer: Vivid crimson red styling (Review #8)
                  btnBorder =
                    "border-red-500 bg-red-500/15 text-red-900 dark:text-red-300 font-bold ring-2 ring-red-500/40"
                } else {
                  btnBorder = "border-border/60 opacity-60"
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  disabled={isSubmitted}
                  className={`w-full text-left rounded-xl border p-3.5 text-xs leading-relaxed transition-all cursor-pointer shadow-xs flex items-center justify-between gap-3 ${btnBorder}`}
                >
                  <span className="flex-1">{opt}</span>
                  {isSubmitted && opt === page.correct && (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  )}
                  {isSubmitted && isSelected && !isCorrect && (
                    <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Submission and Feedback Banner */}
          {!isSubmitted ? (
            <Button
              onClick={handleSubmit}
              disabled={!selectedOption}
              className="w-full font-semibold shadow-sm"
            >
              Verify Clinical Diagnosis
            </Button>
          ) : (
            <div className="space-y-3 animate-in fade-in">
              {/* Review #8: Vivid Red for incorrect / Vivid Green for correct */}
              <div
                className={`rounded-xl border p-4 text-xs leading-relaxed space-y-2 ${
                  isCorrect
                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-950 dark:text-emerald-200"
                    : "bg-red-500/15 border-red-500 text-red-950 dark:text-red-200"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  {isCorrect ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <span>Accurate Diagnosis!</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="text-red-700 dark:text-red-400">Diagnostic Inaccuracy</span>
                    </>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="font-semibold text-foreground">Clinical Reasoning:</span>
                  <p>{page.reasoning}</p>
                </div>
              </div>

              {onNext && (
                <Button onClick={onNext} className="w-full gap-2 shadow-sm">
                  <span>Continue to Next Case</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
