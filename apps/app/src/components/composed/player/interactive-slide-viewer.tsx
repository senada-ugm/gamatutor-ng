import { useState } from "react"
import { ArrowLeft, ArrowRight, GraduationCap } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import type {
  CardsPage,
  ContentPage,
  CourseDefinition,
  DividerPage,
  HeroPage,
  HotspotPage,
  ImageGradingPage,
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

interface InteractiveSlideViewerProps {
  course: CourseDefinition
  initialSlideIndex?: number
  onSlideChange?: (index: number, page: SlidePage) => void
  onCompleteModule?: (moduleId: string) => void
  onClaimCertificate?: () => void
  className?: string
}

export function InteractiveSlideViewer({
  course,
  initialSlideIndex = 0,
  onSlideChange,
  onCompleteModule,
  onClaimCertificate,
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
  const currentItem = allSlides[currentIndex] || allSlides[0]
  const totalSlides = allSlides.length

  useSlideTelemetry({
    courseId: course.id,
    moduleId: currentItem?.moduleId || "",
    slideId: currentItem?.page.id || "",
  })

  function goToSlide(index: number) {
    if (index >= 0 && index < totalSlides) {
      setCurrentIndex(index)
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

  return (
    <div
      className={`mx-auto flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border bg-background shadow-xs transition-all duration-300 ${className}`}
      style={{ maxHeight: "calc(100vh - 4.5rem)" }}
    >
      {/* Top Header Chrome */}
      <div className="flex shrink-0 items-center justify-between border-b bg-card/60 px-5 py-3 backdrop-blur-xs">
        <div className="flex items-center gap-2.5 truncate">
          <Badge variant="outline" className="shrink-0 border-primary/20 bg-primary/5 font-mono text-xs text-primary">
            {moduleLabel.split("—")[0].trim()}
          </Badge>
          <span className="hidden truncate text-xs font-semibold text-foreground/90 sm:inline">{moduleLabel}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-xs font-medium text-muted-foreground">
            <span>Slide</span>
            <span className="font-bold text-foreground">{currentIndex + 1}</span>
            <span>/</span>
            <span>{totalSlides}</span>
          </div>

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={currentIndex === 0}
              onClick={handlePrev}
              className="h-8 gap-1 px-2 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Previous</span>
            </Button>
            <Button size="sm" variant="default" onClick={handleNext} className="h-8 gap-1 px-2 text-xs">
              <span className="hidden sm:inline">{currentIndex === totalSlides - 1 ? "Complete" : "Next"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Slide Content Stage - Clamped Viewport with Scroll when needed */}
      <div className="flex-1 space-y-6 overflow-y-auto p-6 md:p-8">
        {page.type === "hero" && <HeroSlide page={page as HeroPage} onStart={handleNext} />}
        {page.type === "divider" && <DividerSlide page={page as DividerPage} onProceed={handleNext} />}
        {page.type === "content" && <ContentSlide page={page as ContentPage} />}
        {page.type === "cards" && <CardsSlide page={page as CardsPage} />}
        {page.type === "hotspot" && <HotspotSlide page={page as HotspotPage} onAllCompleted={handleNext} />}
        {page.type === "match" && <MatchSlide page={page as MatchPage} onDone={handleNext} />}
        {page.type === "image-grading" && <ClinicalFundusGrading page={page as ImageGradingPage} onNext={handleNext} />}
        {page.type === "quiz" && (
          <ClinicalQuizRunner
            questions={
              (course.modules
                .find((m) => m.id === "evaluasi")
                ?.pages.filter((p) => p.type === "quiz") as QuizPage[]) || [page as QuizPage]
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

      {/* Optional Persistent Narration Bar on Content & Cards with Audio */}
      {"transcript" in page && page.transcript && (
        <div className="shrink-0 border-t bg-card/80 p-3">
          <AudioNarrationBar transcript={page.transcript} />
        </div>
      )}
    </div>
  )
}

function HeroSlide({ page, onStart }: { page: HeroPage; onStart: () => void }) {
  return (
    <div className="flex animate-in flex-col items-center justify-center space-y-6 py-10 text-center fade-in">
      <div className="rounded-2xl bg-primary/10 p-5 text-primary ring-8 ring-primary/5">
        <GraduationCap className="h-12 w-12" />
      </div>

      <div className="max-w-2xl space-y-3">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">{page.title}</h1>
        {page.body && <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">{page.body}</p>}
      </div>

      <div className="pt-4">
        <Button size="lg" onClick={onStart} className="gap-2 px-8 text-base shadow-md">
          <span>Start Interactive Learning</span>
          <ArrowRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}

function DividerSlide({ page, onProceed }: { page: DividerPage; onProceed: () => void }) {
  return (
    <div className="flex animate-in flex-col items-center justify-center space-y-5 py-16 text-center fade-in">
      {page.kicker && (
        <Badge
          variant="outline"
          className="border-primary/20 bg-primary/5 px-3 py-1 font-mono text-xs tracking-widest text-primary uppercase"
        >
          {page.kicker}
        </Badge>
      )}
      <h2 className="max-w-xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{page.title}</h2>
      <div className="mt-2 h-1 w-16 rounded-full bg-primary" />
      <div className="pt-6">
        <Button onClick={onProceed} className="gap-2">
          <span>Continue</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function ContentSlide({ page }: { page: ContentPage }) {
  return (
    <div className="animate-in space-y-6 fade-in">
      <div className="space-y-1">
        {page.kicker && (
          <Badge variant="outline" className="border-primary/20 bg-primary/5 font-mono text-xs text-primary uppercase">
            {page.kicker}
          </Badge>
        )}
        {page.title && <h2 className="text-2xl font-bold tracking-tight">{page.title}</h2>}
      </div>

      {page.body && (
        <div className="space-y-2 text-sm leading-relaxed whitespace-pre-line text-foreground/90">{page.body}</div>
      )}

      {/* Slide 7 Auto-Reveal 2-Column List (Reviews #5 & #6) */}
      {page.reveal_steps && page.reveal_steps.length > 0 && <AnimatedRevealList steps={page.reveal_steps} />}

      {/* Image if present */}
      {page.image && (
        <div className="space-y-2">
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
      <div className="space-y-1">
        {page.kicker && (
          <Badge variant="outline" className="border-primary/20 bg-primary/5 font-mono text-xs text-primary uppercase">
            {page.kicker}
          </Badge>
        )}
        {page.title && <h2 className="text-2xl font-bold tracking-tight">{page.title}</h2>}
        {page.intro && <p className="text-sm text-muted-foreground">{page.intro}</p>}
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
