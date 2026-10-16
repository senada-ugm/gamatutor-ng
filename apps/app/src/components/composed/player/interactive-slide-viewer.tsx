import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Eye, FileText, Volume2 } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import type {
  CardsPage,
  ContentPage,
  CourseDefinition,
  DividerPage,
  HeroPage,
  HotspotPage,
  MatchPage,
  QuizPage,
  SlidePage,
} from "@/lib/content/course-types"
import { AudioNarrationBar } from "./audio-narration-bar"
import { TranscriptViewer } from "./transcript-viewer"
import { EyeAnatomyViewer } from "./eye-anatomy-viewer"
import { SequentialHotspotViewer } from "./sequential-hotspot-viewer"
import { AnimatedRevealList } from "./animated-reveal-list"
import { MatchingPairGame } from "./matching-pair-game"
import { ClinicalFundusGrading } from "./clinical-fundus-grading"
import { ClinicalQuizRunner } from "./clinical-quiz-runner"

import { useSlideTelemetry } from "@/lib/use-slide-telemetry"
import { usePlayerDeck } from "@/components/composed/player/player-deck-context"

interface InteractiveSlideViewerProps {
  course: CourseDefinition
  initialSlideIndex?: number
  onSlideChange?: (index: number, page: SlidePage) => void
  onCompleteModule?: (moduleId: string) => void
  onClaimCertificate?: () => void
  /** Server-side quiz backing the evaluasi section (PLANS 4.3) — attempts
   *  are graded and recorded through the quiz engine. */
  postTestQuizId?: string
  className?: string
}

export function InteractiveSlideViewer({
  course,
  initialSlideIndex = 0,
  onSlideChange,
  onCompleteModule,
  onClaimCertificate,
  postTestQuizId,
  className = "",
}: InteractiveSlideViewerProps) {
  // Flatten all pages across all modules into a linear slide sequence
  const allSlides = course.modules.flatMap((m) =>
    m.pages.map((p) => ({
      page: p,
      moduleId: m.id,
      moduleLabel: m.label,
    }))
  )

  const [currentIndex, setCurrentIndex] = useState<number>(initialSlideIndex)
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState<number>(0)
  const currentItem = allSlides[currentIndex] || allSlides[0]
  const totalSlides = allSlides.length
  const deck = usePlayerDeck()

  // Report slide landings to the steps sidebar, and honor its jump
  // requests (gamatutor-ng sidebar model — see player-deck-context).
  const currentModuleId = currentItem?.moduleId
  const currentModuleIdx = currentModuleId ? course.modules.findIndex((m) => m.id === currentModuleId) : -1
  useEffect(() => {
    if (deck && currentModuleId && currentModuleIdx >= 0) {
      deck.onSlideChange(currentModuleId, currentModuleIdx)
    }
  }, [deck, currentModuleId, currentModuleIdx])

  const lastJumpNonce = useRef<number>(0)
  const jump = deck?.jump ?? null
  const jumpNonce = jump?.nonce ?? 0
  useEffect(() => {
    if (!jump || jump.nonce === lastJumpNonce.current) return
    lastJumpNonce.current = jump.nonce
    const target = allSlides.findIndex((s) => s.moduleId === jump.moduleId)
    if (target >= 0) {
      setCurrentIndex(target)
      setCurrentPlaybackTime(0)
      onSlideChange?.(target, allSlides[target].page)
    }
    // jumpNonce is the retrigger; allSlides/onSlideChange are stable per
    // course render.
  }, [jumpNonce])

  useSlideTelemetry({
    courseId: course.id,
    moduleId: currentItem?.moduleId || "",
    slideId: currentItem?.page.id || "",
  })

  function goToSlide(index: number) {
    if (index >= 0 && index < totalSlides) {
      setCurrentIndex(index)
      setCurrentPlaybackTime(0)
      onSlideChange?.(index, allSlides[index].page)
    }
  }

  function handleNext() {
    if (currentIndex < totalSlides - 1) {
      goToSlide(currentIndex + 1)
    } else {
      onCompleteModule?.(currentItem.moduleId)
    }
  }

  function handlePrev() {
    if (currentIndex > 0) {
      goToSlide(currentIndex - 1)
    }
  }

  if (!currentItem) {
    return <div className="p-8 text-center text-muted-foreground">No slides available.</div>
  }

  const { page, moduleLabel } = currentItem

  const isHero = page.type === "hero"

  return (
    <div
      className={`flex w-full flex-1 flex-col overflow-hidden rounded-[4px] border border-[#e2e6ea] bg-white shadow-[0_2px_14px_rgba(20,40,60,0.08)] transition-all duration-300 dark:border-border dark:bg-card ${className}`}
      style={{ minHeight: "calc(100vh - 52px)" }}
    >
      {/* Top Global Progress Bar (gamatutor-ng card-top-progress: teal fill) */}
      <div className="h-1 w-full shrink-0 bg-[#e2e6ea] dark:bg-muted/60">
        <div
          className="h-full bg-[#5bb4b2] transition-all duration-300 ease-out"
          style={{ width: `${Math.round(((currentIndex + 1) / totalSlides) * 100)}%` }}
        />
      </div>

      {/* Top Header Chrome (gamatutor-ng card-header) - Hero doesn't have card header */}
      {!isHero && (
        <div className="flex shrink-0 items-center justify-between border-b bg-card/80 px-6 py-3 backdrop-blur-xs">
          <div className="flex items-center gap-3 truncate">
            <Badge
              variant="outline"
              className="shrink-0 border-primary/25 bg-primary/10 font-mono text-xs font-bold text-primary"
            >
              {moduleLabel.split("—")[0].trim()}
            </Badge>
            <span className="hidden truncate text-xs font-semibold text-foreground/80 sm:inline">{moduleLabel}</span>
          </div>

          {/* Brand Logo & Mark (gamatutor-ng brandlogo) */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <span className="flex size-6 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs shadow-xs">
                <Eye className="size-3.5 stroke-[2.2]" />
              </span>
              <span className="hidden tracking-tight sm:inline">{course.brand?.name || "DRIVE Initiative"}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Slide Content Stage - Clamped Viewport with Scroll when needed */}
      <div className={isHero ? "flex-1 overflow-hidden p-0" : "flex-1 space-y-6 overflow-y-auto p-6 md:p-8"}>
        {page.type === "hero" && <HeroSlide page={page} onStart={handleNext} />}
        {page.type === "divider" && <DividerSlide page={page} onProceed={handleNext} />}
        {page.type === "content" && <ContentSlide page={page} currentTime={currentPlaybackTime} />}
        {page.type === "cards" && <CardsSlide page={page} />}
        {page.type === "hotspot" && <HotspotSlide page={page} onAllCompleted={handleNext} />}
        {page.type === "match" && <MatchSlide page={page} onDone={handleNext} />}
        {page.type === "image-grading" && <ClinicalFundusGrading page={page} onNext={handleNext} />}
        {page.type === "quiz" && (
          <ClinicalQuizRunner
            quizId={postTestQuizId}
            questions={
              (course.modules
                .find((m) => m.id === "evaluasi")
                ?.pages.filter((p) => p.type === "quiz") as QuizPage[]) || [page]
            }
            onRetake={() => {
              const evalStartIdx = allSlides.findIndex((s) => s.moduleId === "evaluasi")
              if (evalStartIdx !== -1) {
                goToSlide(evalStartIdx)
              }
            }}
            onClaimCertificate={onClaimCertificate}
            onComplete={(_score, passed) => {
              if (passed) {
                onCompleteModule?.(currentItem.moduleId)
              }
            }}
          />
        )}
      </div>

      {/* Persistent Audio Narration Bar on Content & Cards with Voiceover Audio */}
      {!isHero && (("audio" in page && page.audio) || ("transcript" in page && page.transcript)) && (
        <div className="shrink-0 border-t bg-card/80 p-3">
          <AudioNarrationBar
            key={page.id}
            audioUrl={"audio" in page && page.audio ? page.audio : undefined}
            transcript={"transcript" in page && page.transcript ? page.transcript : undefined}
            onTimeUpdate={setCurrentPlaybackTime}
          />
        </div>
      )}

      {/* Bottom Card Footer Chrome (from gamatutor-ng card-footer) - Hero has NO footer nav */}
      {!isHero && (
        <div className="flex shrink-0 items-center justify-between border-t bg-card/90 px-6 py-2.5 backdrop-blur-xs">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {"audio" in page && page.audio ? (
              <Badge
                variant="outline"
                className="gap-1.5 border-primary/30 bg-primary/5 text-[11px] font-medium text-primary"
              >
                <Volume2 className="size-3" />
                <span>Narasi Suara Tersedia</span>
              </Badge>
            ) : "transcript" in page && page.transcript ? (
              <Badge variant="outline" className="gap-1.5 border-muted text-[11px] font-normal text-muted-foreground">
                <FileText className="size-3" />
                <span>Transkrip Narasi Tersedia</span>
              </Badge>
            ) : (
              <span className="text-[11px] text-muted-foreground/75">Kurikulum Skrining Klinis FK-KMK UGM</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              <Button
                size="icon-sm"
                variant="outline"
                disabled={currentIndex === 0}
                onClick={handlePrev}
                aria-label="Halaman sebelumnya"
                className="size-8 rounded-full"
              >
                <ArrowLeft className="size-4" />
              </Button>
              <span className="font-mono text-xs font-bold whitespace-nowrap text-[#173a5e] dark:text-foreground">
                {currentIndex + 1} / {totalSlides}
              </span>
              <Button
                size="icon-sm"
                disabled={currentIndex === totalSlides - 1}
                onClick={handleNext}
                aria-label="Halaman berikutnya"
                className="size-8 rounded-full"
              >
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function HeroSlide({ page, onStart }: { page: HeroPage; onStart: () => void }) {
  return (
    <div className="relative flex h-full min-h-[520px] w-full flex-1 overflow-hidden bg-[#173a5e] text-white">
      {/* Background SVG Illustration matching gamatutor-ng hero-illustration.svg */}
      <img
        className="pointer-events-none absolute inset-0 size-full object-cover"
        src="/content/drive-retinopati/assets/hero-illustration.svg"
        alt=""
      />
      {/* Dark gradient overlay matching gamatutor-ng .hero::after */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background: "linear-gradient(100deg, rgba(15,35,55,.88) 0%, rgba(15,35,55,.55) 42%, rgba(15,35,55,.15) 68%)",
        }}
      />
      {/* Hero content aligned bottom-left matching gamatutor-ng .hero-content */}
      <div className="relative z-20 flex size-full flex-col justify-end p-10 md:p-12">
        <h1 className="mb-2 max-w-[560px] text-[28px] leading-tight font-bold tracking-tight text-white">
          {page.title}
        </h1>
        {page.body && <p className="mb-6 max-w-[480px] text-sm leading-relaxed text-white/90">{page.body}</p>}
        <div>
          <button
            type="button"
            onClick={onStart}
            className="cursor-pointer bg-[#132d47] px-8 py-3.5 text-sm font-bold tracking-wider text-white transition-colors hover:bg-[#173a5e]"
            style={{ clipPath: "polygon(6% 0, 100% 0, 94% 100%, 0% 100%)" }}
          >
            MULAI &rarr;
          </button>
        </div>
      </div>
    </div>
  )
}

function DividerSlide({ page }: { page: DividerPage; onProceed: () => void }) {
  return (
    <div
      className="flex min-h-[380px] flex-1 flex-col items-center justify-center p-10 text-center text-white"
      style={{
        background: "linear-gradient(120deg, #132d47, #173a5e 55%, #2d77c2)",
      }}
    >
      {page.kicker && (
        <div className="mb-2.5 text-[13px] font-bold tracking-[0.15em] text-white/80 uppercase">{page.kicker}</div>
      )}
      <div className="max-w-[600px] text-[30px] leading-tight font-extrabold tracking-tight text-white">
        {page.title || ""}
      </div>
    </div>
  )
}

function ContentSlide({ page, currentTime }: { page: ContentPage; currentTime?: number }) {
  return (
    <div className="animate-in space-y-6 fade-in">
      <div className="space-y-1.5">
        {page.kicker && (
          <Badge
            variant="outline"
            className="border-primary/20 bg-primary/5 font-mono text-xs font-bold text-primary uppercase"
          >
            {page.kicker}
          </Badge>
        )}
        {page.title && <h2 className="text-2xl font-bold tracking-tight text-foreground">{page.title}</h2>}
        <div className="h-0.5 w-full bg-gradient-to-r from-primary via-primary/40 to-transparent" />
      </div>

      {page.body && (
        <div className="space-y-2 text-sm leading-relaxed whitespace-pre-line text-foreground/90">{page.body}</div>
      )}

      {/* Slide 7 Auto-Reveal 2-Column List with Audio Cue Sync (Reviews #5 & #6) */}
      {page.reveal_steps && page.reveal_steps.length > 0 && (
        <AnimatedRevealList steps={page.reveal_steps} currentTime={currentTime} />
      )}

      {/* Image if present — v4.3 imageLayout "below" stacks it under the
          text at reading width (reference content-layout.stacked) instead
          of the full-width default. */}
      {page.image && (
        <div className={page.imageLayout === "below" ? "mx-auto w-full max-w-xl space-y-2" : "space-y-2"}>
          <div className="overflow-hidden rounded-xl border bg-black/5 shadow-inner">
            <img src={page.image} alt={page.title || ""} className="h-auto max-h-[420px] w-full object-contain" />
          </div>
          {page.imageCaption && <p className="text-center text-xs text-muted-foreground italic">{page.imageCaption}</p>}
        </div>
      )}

      {/* Transcript collapsible viewer (Review #1) */}
      {page.transcript && <TranscriptViewer transcript={page.transcript} />}
    </div>
  )
}

function CardsSlide({ page }: { page: CardsPage }) {
  const colClass =
    page.columns === 3
      ? "grid-cols-1 md:grid-cols-3"
      : page.columns === 4
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        : "grid-cols-1 sm:grid-cols-2"

  return (
    <div className="animate-in space-y-6 fade-in">
      <div className="space-y-1.5">
        {page.kicker && (
          <Badge variant="outline" className="border-primary/20 bg-primary/5 font-mono text-xs text-primary uppercase">
            {page.kicker}
          </Badge>
        )}
        {page.title && <h2 className="text-2xl font-bold tracking-tight text-foreground">{page.title}</h2>}
        <div className="h-0.5 w-full bg-gradient-to-r from-primary via-primary/40 to-transparent" />
        {page.intro && <p className="pt-1 text-sm text-muted-foreground">{page.intro}</p>}
      </div>

      <div className={`grid gap-4 ${colClass}`}>
        {page.cards.map((c, idx) => (
          <div
            key={idx}
            className={`flex flex-col justify-between rounded-xl border p-5 shadow-xs transition-all hover:shadow-sm ${
              c.dark ? "border-slate-800 bg-slate-900 text-white" : "border-border bg-card text-card-foreground"
            }`}
          >
            {c.big && <span className="text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">{c.big}</span>}
            {c.title && <h4 className="mt-1 text-sm font-semibold">{c.title}</h4>}
            <p className={`mt-2 text-xs leading-relaxed ${c.dark ? "text-slate-300" : "text-muted-foreground"}`}>
              {c.body}
            </p>
          </div>
        ))}
      </div>

      {page.trailingImage && (
        <div className="space-y-2 pt-2">
          <div className="overflow-hidden rounded-xl border bg-black/5 shadow-inner">
            <img src={page.trailingImage} alt="" className="h-auto max-h-[350px] w-full object-contain" />
          </div>
          {page.trailingCaption && (
            <p className="text-center text-xs text-muted-foreground italic">{page.trailingCaption}</p>
          )}
        </div>
      )}

      {page.transcript && <TranscriptViewer transcript={page.transcript} />}
    </div>
  )
}

function HotspotSlide({ page, onAllCompleted }: { page: HotspotPage; onAllCompleted: () => void }) {
  // If it's modul2-p5 (pathophysiology), render SequentialHotspotViewer (Review #4)
  if (page.id === "modul2-p5" || page.title.toLowerCase().includes("patofisiologi")) {
    return <SequentialHotspotViewer page={page} onAllCompleted={onAllCompleted} />
  }

  // Otherwise render EyeAnatomyViewer (Review #2)
  return <EyeAnatomyViewer page={page} />
}

function MatchSlide({ page, onDone }: { page: MatchPage; onDone: () => void }) {
  return (
    <div className="animate-in space-y-4 fade-in">
      {page.kicker && (
        <Badge variant="outline" className="border-primary/20 bg-primary/5 font-mono text-xs text-primary uppercase">
          {page.kicker}
        </Badge>
      )}
      <MatchingPairGame pairs={page.pairs} title={page.title} intro={page.intro} onComplete={() => onDone()} />
    </div>
  )
}
