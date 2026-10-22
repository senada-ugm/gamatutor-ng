import { useEffect, useState, type DragEvent } from "react"
import { ArrowRight, CheckCircle2, RotateCcw, XCircle, Award } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import type { MatchPair } from "@/lib/content/course-types"

interface MatchingPairGameProps {
  pairs: MatchPair[]
  title?: string
  intro?: string
  onComplete?: (score: number) => void
  /** Shown after verifying, so the learner reads the per-pair result before
   *  moving on instead of the slide changing under them. */
  onContinue?: () => void
  className?: string
}

export function MatchingPairGame({
  pairs,
  title = "Cocokkan faktor risiko dengan penjelasannya",
  intro,
  onComplete,
  onContinue,
  className = "",
}: MatchingPairGameProps) {
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null)
  const [matches, setMatches] = useState<Record<string, string>>({}) // leftId -> rightId
  const [shuffledRights, setShuffledRights] = useState<MatchPair[]>([])
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false)
  const [draggingLeft, setDraggingLeft] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  useEffect(() => {
    // Shuffle right items on mount or when pairs change
    const shuffled = [...pairs].sort(() => Math.random() - 0.5)
    setShuffledRights(shuffled)
    setMatches({})
    setSelectedLeft(null)
    setIsSubmitted(false)
  }, [pairs])

  function handleSelectLeft(leftId: string) {
    if (isSubmitted) return
    if (selectedLeft === leftId) {
      setSelectedLeft(null)
    } else {
      setSelectedLeft(leftId)
    }
  }

  function pair(leftId: string, rightId: string) {
    // If another left was previously paired with this rightId, unpair it
    const newMatches = { ...matches }
    for (const [k, v] of Object.entries(newMatches)) {
      if (v === rightId) {
        delete newMatches[k]
      }
    }
    newMatches[leftId] = rightId
    setMatches(newMatches)
    setSelectedLeft(null)
  }

  function handleSelectRight(rightId: string) {
    if (isSubmitted) return
    if (!selectedLeft) return
    pair(selectedLeft, rightId)
  }

  function handleDrop(rightId: string, e: DragEvent) {
    e.preventDefault()
    const leftId = e.dataTransfer.getData("text/plain") || draggingLeft
    setDraggingLeft(null)
    setDropTarget(null)
    if (isSubmitted || !leftId) return
    pair(leftId, rightId)
  }

  function handleUnpair(leftId: string) {
    if (isSubmitted) return
    const newMatches = { ...matches }
    delete newMatches[leftId]
    setMatches(newMatches)
  }

  function handleSubmit() {
    setIsSubmitted(true)
    let correctCount = 0
    for (const pair of pairs) {
      if (matches[pair.id] === pair.id) {
        correctCount++
      }
    }
    const scorePct = Math.round((correctCount / pairs.length) * 100)
    onComplete?.(scorePct)
  }

  function handleReset() {
    const shuffled = [...pairs].sort(() => Math.random() - 0.5)
    setShuffledRights(shuffled)
    setMatches({})
    setSelectedLeft(null)
    setIsSubmitted(false)
  }

  const pairedCount = Object.keys(matches).length
  const totalCount = pairs.length
  const allPaired = pairedCount === totalCount

  // Color mapping for matched pairs
  const colorMap: Record<number, string> = {
    0: "border-blue-500 bg-blue-500/10 text-blue-900 dark:text-blue-300",
    1: "border-emerald-500 bg-emerald-500/10 text-emerald-900 dark:text-emerald-300",
    2: "border-purple-500 bg-purple-500/10 text-purple-900 dark:text-purple-300",
    3: "border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-300",
    4: "border-rose-500 bg-rose-500/10 text-rose-900 dark:text-rose-300",
    5: "border-cyan-500 bg-cyan-500/10 text-cyan-900 dark:text-cyan-300",
  }

  return (
    <div className={`space-y-5 ${className}`}>
      {/* Title & Guidance Header */}
      <div className="space-y-1 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
          <Badge variant="outline" className="font-mono text-xs">
            Terpasang: {pairedCount} / {totalCount}
          </Badge>
        </div>
        {intro ? (
          <p className="text-xs text-muted-foreground">{intro}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Seret kartu di kiri ke penjelasan yang sesuai di kanan, atau klik kartu lalu klik kotak tujuannya.
          </p>
        )}
      </div>

      {/* 2-Column Matching Arena */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Column: Risk Factor Terms */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Faktor Risiko</h4>
          <div className="space-y-2.5">
            {pairs.map((pair, pIdx) => {
              const isSelected = selectedLeft === pair.id
              const pairedRightId = matches[pair.id]
              const isPaired = !!pairedRightId

              let borderClass = "border-border hover:border-primary/50"
              if (isSelected) {
                borderClass = "border-primary ring-2 ring-primary/30 bg-primary/5"
              } else if (isSubmitted) {
                const isCorrect = pairedRightId === pair.id
                borderClass = isCorrect
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                  : "border-red-500 bg-red-500/10 text-red-800 dark:text-red-300"
              } else if (isPaired) {
                borderClass = colorMap[pIdx % 6]
              }

              return (
                <div
                  key={pair.id}
                  onClick={() => handleSelectLeft(pair.id)}
                  draggable={!isSubmitted}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", pair.id)
                    e.dataTransfer.effectAllowed = "link"
                    setDraggingLeft(pair.id)
                    setSelectedLeft(pair.id)
                  }}
                  onDragEnd={() => {
                    setDraggingLeft(null)
                    setDropTarget(null)
                  }}
                  className={`flex cursor-grab items-center active:cursor-grabbing ${draggingLeft === pair.id ? "opacity-50" : ""} justify-between rounded-xl border p-3.5 text-sm font-semibold shadow-xs transition-all ${borderClass}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted font-mono text-xs font-bold">
                      {pIdx + 1}
                    </span>
                    <span>{pair.left}</span>
                  </div>

                  {isSubmitted ? (
                    pairedRightId === pair.id ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                    ) : (
                      <XCircle className="h-5 w-5 shrink-0 text-red-600" />
                    )
                  ) : isPaired ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleUnpair(pair.id)
                      }}
                      className="h-6 px-1.5 text-xs text-muted-foreground hover:text-destructive"
                      title="Lepas pasangan"
                    >
                      Lepas
                    </Button>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column: Explanations */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Penjelasan Klinis</h4>
          <div className="space-y-2.5">
            {shuffledRights.map((pair) => {
              // Find which left item is linked to this right item
              const linkedLeftEntry = Object.entries(matches).find(([_, rId]) => rId === pair.id)
              const linkedLeftId = linkedLeftEntry ? linkedLeftEntry[0] : null
              const linkedIndex = linkedLeftId ? pairs.findIndex((p) => p.id === linkedLeftId) : -1

              let borderClass = selectedLeft
                ? "border-dashed border-primary/60 hover:bg-primary/5 cursor-pointer"
                : "border-border cursor-pointer hover:border-muted-foreground"

              if (isSubmitted && linkedLeftId) {
                const isCorrect = linkedLeftId === pair.id
                borderClass = isCorrect
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                  : "border-red-500 bg-red-500/10 text-red-800 dark:text-red-300"
              } else if (linkedIndex !== -1) {
                borderClass = colorMap[linkedIndex % 6]
              }
              if (!isSubmitted && dropTarget === pair.id) {
                borderClass = "border-primary bg-primary/10 ring-2 ring-primary/40 cursor-pointer"
              }

              return (
                <div
                  key={pair.id}
                  onClick={() => handleSelectRight(pair.id)}
                  onDragOver={(e) => {
                    if (isSubmitted) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = "link"
                    if (dropTarget !== pair.id) setDropTarget(pair.id)
                  }}
                  onDragLeave={() => setDropTarget((t) => (t === pair.id ? null : t))}
                  onDrop={(e) => handleDrop(pair.id, e)}
                  className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs leading-relaxed shadow-xs transition-all ${borderClass}`}
                  role="button"
                  tabIndex={0}
                >
                  {linkedIndex !== -1 && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {linkedIndex + 1}
                    </span>
                  )}
                  <p className="flex-1">{pair.right}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between border-t pt-4">
        {isSubmitted ? (
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-semibold">
              Skor: {pairs.filter((p) => matches[p.id] === p.id).length} dari {pairs.length} pasangan benar
            </span>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            {allPaired
              ? "Semua sudah dipasangkan. Klik Periksa Jawaban."
              : "Pasangkan semua kartu untuk memeriksa jawaban."}
          </div>
        )}

        <div className="flex items-center gap-2">
          {isSubmitted ? (
            <>
              <Button size="sm" variant="outline" onClick={handleReset} className="gap-1.5">
                <RotateCcw className="h-4 w-4" />
                Coba Lagi
              </Button>
              {onContinue && (
                <Button size="sm" onClick={onContinue} className="gap-1.5 font-semibold">
                  Lanjut
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </>
          ) : (
            <Button size="sm" disabled={!allPaired} onClick={handleSubmit} className="gap-1.5 font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              Periksa Jawaban
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
