import { useState } from "react"
import { CheckCircle2, XCircle, ArrowRight, Eye, ZoomIn, ZoomOut } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import type { ImageGradingPage, LesionCoordinate } from "@/lib/content/course-types"

interface ClinicalFundusGradingProps {
  page: ImageGradingPage
  onGraded?: (isCorrect: boolean, selected: string) => void
  onNext?: () => void
  className?: string
}

export function ClinicalFundusGrading({ page, onGraded, onNext, className = "" }: ClinicalFundusGradingProps) {
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
          <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
            SIMULASI • {page.level || "GRADING KLINIS"}
          </Badge>
          <h2 className="text-xl font-bold tracking-tight">Evaluasi Klinis Foto Fundus</h2>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setIsZoomed(!isZoomed)}>
            {isZoomed ? <ZoomOut className="h-3.5 w-3.5" /> : <ZoomIn className="h-3.5 w-3.5" />}
            {isZoomed ? "Ukuran Normal" : "Perbesar 1.5x"}
          </Button>

          {isSubmitted && page.lesions.length > 0 && (
            <Button
              size="sm"
              variant={showLesions ? "secondary" : "outline"}
              className="h-8 gap-1.5 text-xs"
              onClick={() => setShowLesions(!showLesions)}
            >
              <Eye className="h-3.5 w-3.5" />
              {showLesions ? "Sembunyikan Penanda Lesi" : "Tampilkan Penanda Lesi"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* Fundus Examination Stage */}
        <div className="flex flex-col items-center lg:col-span-8">
          <div className="flex w-full max-w-2xl justify-center overflow-hidden rounded-2xl border bg-black shadow-lg">
            {/* Sized to the photo itself, so lesion % coordinates map onto the
                photo. They used to be laid over a box wider than the
                letterboxed photo, which pushed every marker sideways off its
                lesion (DRIVE review 29 Okt 2026). */}
            <div
              className={`relative transition-transform duration-300 select-none ${isZoomed ? "z-20 scale-125 cursor-move" : ""}`}
            >
              <img
                src={page.image}
                alt="Foto fundus retina"
                className="block h-auto max-h-[500px] w-auto max-w-full"
                loading="eager"
              />

              {isSubmitted && showLesions && page.lesions.length > 0 && <LesionArrows lesions={page.lesions} />}
            </div>
          </div>

          <div className="mt-2 flex w-full items-center justify-between px-1 text-xs text-muted-foreground">
            <span>Foto fundus standar 45° berpusat di makula</span>
            {isSubmitted && page.lesions.length > 0 && (
              <span className="font-medium text-red-500">{page.lesions.length} lesi ditandai</span>
            )}
          </div>
        </div>

        {/* Diagnostic Options & Rationale Panel */}
        <div className="space-y-4 lg:col-span-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">Pilihan Diagnosis Klinis:</h3>
            <p className="text-xs text-muted-foreground">
              Pilih diagnosis yang tepat untuk pasien ini berdasarkan temuan mikrovaskular retina.
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
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border p-3.5 text-left text-xs leading-relaxed shadow-xs transition-all ${btnBorder}`}
                >
                  <span className="flex-1">{opt}</span>
                  {isSubmitted && opt === page.correct && (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  )}
                  {isSubmitted && isSelected && !isCorrect && <XCircle className="h-5 w-5 shrink-0 text-red-600" />}
                </button>
              )
            })}
          </div>

          {/* Submission and Feedback Banner */}
          {!isSubmitted ? (
            <Button onClick={handleSubmit} disabled={!selectedOption} className="w-full font-semibold shadow-sm">
              Periksa Diagnosis
            </Button>
          ) : (
            <div className="animate-in space-y-3 fade-in">
              {/* Review #8: Vivid Red for incorrect / Vivid Green for correct */}
              <div
                className={`space-y-2 rounded-xl border p-4 text-xs leading-relaxed ${
                  isCorrect
                    ? "border-emerald-500 bg-emerald-500/15 text-emerald-950 dark:text-emerald-200"
                    : "border-red-500 bg-red-500/15 text-red-950 dark:text-red-200"
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-bold">
                  {isCorrect ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <span>Diagnosis Tepat!</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="text-red-700 dark:text-red-400">Diagnosis Kurang Tepat</span>
                    </>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="font-semibold text-foreground">Alasan Klinis:</span>
                  <p>{page.reasoning}</p>
                </div>
              </div>

              {onNext && (
                <Button onClick={onNext} className="w-full gap-2 shadow-sm">
                  <span>Lanjut ke Kasus Berikutnya</span>
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

/** Gap left between an arrow's tip and the lesion, and the default
 *  label distance — both in % of the photo. */
const TIP_GAP = 2.5
const LABEL_DISTANCE = 15

/**
 * Lesion markers as arrows (DRIVE review 29 Okt 2026): the old dashed
 * ring sat on top of the lesion and hid it, so each lesion now gets an
 * arrow whose tip stops just short of it, with the label at the tail,
 * well clear of the lesion. Labels point outward from the photo centre
 * unless the lesion carries an authored `dx`/`dy` offset.
 */
function LesionArrows({ lesions }: { lesions: LesionCoordinate[] }) {
  const markers = lesions.map((lesion) => {
    let dx = lesion.dx
    let dy = lesion.dy
    if (dx == null || dy == null) {
      const vx = lesion.x - 50
      const vy = lesion.y - 50
      const len = Math.hypot(vx, vy) || 1
      dx = (vx / len) * LABEL_DISTANCE
      dy = (vy / len) * LABEL_DISTANCE
    }
    const lx = Math.min(88, Math.max(12, lesion.x + dx))
    const ly = Math.min(94, Math.max(6, lesion.y + dy))
    const ux = lesion.x - lx
    const uy = lesion.y - ly
    const len = Math.hypot(ux, uy) || 1
    const tipX = lesion.x - (ux / len) * TIP_GAP
    const tipY = lesion.y - (uy / len) * TIP_GAP
    // Arrowhead: a small triangle at the tip, pointing at the lesion.
    const head = 2.2
    const bx = tipX - (ux / len) * head
    const by = tipY - (uy / len) * head
    const px = (-uy / len) * head * 0.55
    const py = (ux / len) * head * 0.55
    return { lesion, lx, ly, tipX, tipY, headPoints: `${tipX},${tipY} ${bx + px},${by + py} ${bx - px},${by - py}` }
  })

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg className="absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
        {markers.map((m, idx) => (
          <g key={idx}>
            <line
              x1={m.lx}
              y1={m.ly}
              x2={m.tipX}
              y2={m.tipY}
              stroke="#ef4444"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            <polygon points={m.headPoints} fill="#ef4444" />
          </g>
        ))}
      </svg>
      {markers.map((m, idx) => (
        <div
          key={idx}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-md border border-red-500 bg-slate-900/90 px-2 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap text-white shadow-md"
          style={{ left: `${m.lx}%`, top: `${m.ly}%` }}
        >
          {m.lesion.label}
        </div>
      ))}
    </div>
  )
}
