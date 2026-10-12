import { useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
} from "lucide-react"
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

interface InteractiveSlideViewerProps {
  course: CourseDefinition
  initialSlideIndex?: number
  onSlideChange?: (index: number, page: SlidePage) => void
  onCompleteModule?: (moduleId: string) => void
  className?: string
}

export function InteractiveSlideViewer({
  course,
  initialSlideIndex = 0,
  onSlideChange,
  onCompleteModule,
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
      className={`mx-auto flex flex-col w-full max-w-5xl rounded-2xl border bg-background shadow-xs overflow-hidden transition-all duration-300 ${className}`}
      style={{ maxHeight: "calc(100vh - 4.5rem)" }}
    >
      {/* Top Header Chrome */}
      <div className="flex shrink-0 items-center justify-between border-b bg-card/60 px-5 py-3 backdrop-blur-xs">
        <div className="flex items-center gap-2.5 truncate">
          <Badge variant="outline" className="font-mono text-xs bg-primary/5 text-primary border-primary/20 shrink-0">
            {moduleLabel.split("—")[0].trim()}
          </Badge>
          <span className="text-xs font-semibold text-foreground/90 truncate hidden sm:inline">
            {moduleLabel}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-muted-foreground">
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
              className="h-8 px-2 text-xs gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Previous</span>
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={handleNext}
              className="h-8 px-2 text-xs gap-1"
            >
              <span className="hidden sm:inline">{currentIndex === totalSlides - 1 ? "Complete" : "Next"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Slide Content Stage - Clamped Viewport with Scroll when needed */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
        {page.type === "hero" && <HeroSlide page={page as HeroPage} onStart={handleNext} />}
        {page.type === "divider" && <DividerSlide page={page as DividerPage} onProceed={handleNext} />}
        {page.type === "content" && <ContentSlide page={page as ContentPage} />}
        {page.type === "cards" && <CardsSlide page={page as CardsPage} />}
        {page.type === "hotspot" && (
          <HotspotSlide page={page as HotspotPage} onAllCompleted={handleNext} />
        )}
        {page.type === "match" && <MatchSlide page={page as MatchPage} onDone={handleNext} />}
        {page.type === "image-grading" && <ImageGradingSlide page={page as ImageGradingPage} onNext={handleNext} />}
        {page.type === "quiz" && <QuizSlide page={page as QuizPage} onNext={handleNext} />}
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
    <div className="flex flex-col items-center justify-center py-10 text-center space-y-6 animate-in fade-in">
      <div className="rounded-2xl bg-primary/10 p-5 text-primary ring-8 ring-primary/5">
        <GraduationCap className="h-12 w-12" />
      </div>

      <div className="max-w-2xl space-y-3">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
          {page.title}
        </h1>
        {page.body && (
          <p className="text-base text-muted-foreground leading-relaxed sm:text-lg">
            {page.body}
          </p>
        )}
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
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-5 animate-in fade-in">
      {page.kicker && (
        <Badge variant="outline" className="px-3 py-1 font-mono text-xs tracking-widest uppercase bg-primary/5 text-primary border-primary/20">
          {page.kicker}
        </Badge>
      )}
      <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl max-w-xl">
        {page.title}
      </h2>
      <div className="w-16 h-1 bg-primary rounded-full mt-2" />
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
    <div className="space-y-6 animate-in fade-in">
      <div className="space-y-1">
        {page.kicker && (
          <Badge variant="outline" className="text-xs uppercase font-mono text-primary border-primary/20 bg-primary/5">
            {page.kicker}
          </Badge>
        )}
        {page.title && <h2 className="text-2xl font-bold tracking-tight">{page.title}</h2>}
      </div>

      {page.body && (
        <div className="text-sm leading-relaxed text-foreground/90 space-y-2 whitespace-pre-line">
          {page.body}
        </div>
      )}

      {/* Slide 7 Auto-Reveal 2-Column List (Reviews #5 & #6) */}
      {page.reveal_steps && page.reveal_steps.length > 0 && (
        <AnimatedRevealList steps={page.reveal_steps} />
      )}

      {/* Image if present */}
      {page.image && (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-xl border bg-black/5 shadow-inner">
            <img src={page.image} alt={page.title || ""} className="w-full h-auto object-contain max-h-[420px]" />
          </div>
          {page.imageCaption && (
            <p className="text-xs text-muted-foreground italic text-center">{page.imageCaption}</p>
          )}
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
    <div className="space-y-6 animate-in fade-in">
      <div className="space-y-1">
        {page.kicker && (
          <Badge variant="outline" className="text-xs uppercase font-mono text-primary border-primary/20 bg-primary/5">
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
              c.dark
                ? "bg-slate-900 text-white border-slate-800"
                : "bg-card text-card-foreground border-border"
            }`}
          >
            {c.big && <span className="text-2xl font-extrabold tracking-tight sm:text-3xl text-primary">{c.big}</span>}
            {c.title && <h4 className="text-sm font-semibold mt-1">{c.title}</h4>}
            <p className={`text-xs mt-2 leading-relaxed ${c.dark ? "text-slate-300" : "text-muted-foreground"}`}>
              {c.body}
            </p>
          </div>
        ))}
      </div>

      {page.trailingImage && (
        <div className="space-y-2 pt-2">
          <div className="overflow-hidden rounded-xl border bg-black/5 shadow-inner">
            <img src={page.trailingImage} alt="" className="w-full h-auto object-contain max-h-[350px]" />
          </div>
          {page.trailingCaption && (
            <p className="text-xs text-muted-foreground italic text-center">{page.trailingCaption}</p>
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
    <div className="space-y-4 animate-in fade-in">
      {page.kicker && (
        <Badge variant="outline" className="text-xs uppercase font-mono text-primary border-primary/20 bg-primary/5">
          {page.kicker}
        </Badge>
      )}
      <MatchingPairGame
        pairs={page.pairs}
        title={page.title}
        intro={page.intro}
        onComplete={() => onDone()}
      />
    </div>
  )
}

function ImageGradingSlide({ page, onNext }: { page: ImageGradingPage; onNext: () => void }) {
  // Temporary interactive fallback for Phase 2 before full Phase 3 grading component lands
  const [selected, setSelected] = useState<string | null>(null)
  const isSubmitted = selected !== null
  const isCorrect = selected === page.correct

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
          FUNDUS GRADING SIMULATION
        </Badge>
        {page.level && <span className="text-xs font-mono text-muted-foreground">{page.level}</span>}
      </div>

      <div className="grid gap-6 md:grid-cols-12 items-start">
        <div className="md:col-span-8 overflow-hidden rounded-xl border bg-black shadow-inner">
          <img src={page.image} alt="Fundus Examination" className="w-full h-auto object-contain max-h-[460px]" />
        </div>

        <div className="md:col-span-4 space-y-4">
          <h3 className="text-sm font-semibold">Diagnosis & Classification:</h3>
          <div className="space-y-2">
            {page.options.map((opt, idx) => {
              const isOptionSelected = selected === opt
              let btnClass = "w-full justify-start text-xs h-auto py-3 px-3 text-left whitespace-normal"
              if (isSubmitted) {
                if (opt === page.correct) {
                  btnClass += " bg-emerald-600 text-white hover:bg-emerald-700"
                } else if (isOptionSelected) {
                  btnClass += " bg-red-600 text-white hover:bg-red-700"
                }
              }

              return (
                <Button
                  key={idx}
                  variant={isOptionSelected && !isSubmitted ? "default" : "outline"}
                  className={btnClass}
                  onClick={() => setSelected(opt)}
                  disabled={isSubmitted}
                >
                  {opt}
                </Button>
              )
            })}
          </div>

          {isSubmitted && (
            <div className="space-y-3">
              <div
                className={`rounded-xl border p-4 text-xs leading-relaxed space-y-1.5 ${
                  isCorrect
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-300"
                    : "bg-red-500/10 border-red-500/30 text-red-900 dark:text-red-300"
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  {isCorrect ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : null}
                  <span>{isCorrect ? "Correct Evaluation" : "Clinical Correction"}</span>
                </div>
                <p>{page.reasoning}</p>
              </div>
              <Button size="sm" onClick={onNext} className="w-full gap-1.5">
                <span>Continue</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function QuizSlide({ page, onNext }: { page: QuizPage; onNext: () => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const isSubmitted = selected !== null
  const isCorrect = selected === page.correct

  return (
    <div className="space-y-6 animate-in fade-in max-w-2xl mx-auto">
      <div className="space-y-2">
        <Badge variant="outline" className="text-xs uppercase font-mono text-primary border-primary/20 bg-primary/5">
          EVALUATION QUIZ
        </Badge>
        <h3 className="text-lg font-bold leading-snug">{page.question}</h3>
      </div>

      <div className="space-y-2.5">
        {page.options.map((opt) => {
          const isSelected = selected === opt.letter
          let btnClass = "w-full justify-start text-xs h-auto py-3.5 px-4 text-left whitespace-normal gap-3"
          if (isSubmitted) {
            if (opt.letter === page.correct) {
              btnClass += " bg-emerald-600 text-white hover:bg-emerald-700"
            } else if (isSelected) {
              btnClass += " bg-red-600 text-white hover:bg-red-700"
            }
          }

          return (
            <Button
              key={opt.letter}
              variant={isSelected && !isSubmitted ? "default" : "outline"}
              className={btnClass}
              onClick={() => setSelected(opt.letter)}
              disabled={isSubmitted}
            >
              <span className="font-mono font-bold">{opt.letter}.</span>
              <span className="flex-1">{opt.text}</span>
            </Button>
          )
        })}
      </div>

      {isSubmitted && (
        <div className="space-y-3">
          <div
            className={`rounded-xl border p-4 text-xs leading-relaxed space-y-1.5 ${
              isCorrect
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-300"
                : "bg-red-500/10 border-red-500/30 text-red-900 dark:text-red-300"
            }`}
          >
            <span className="font-bold">{isCorrect ? "Correct Answer" : "Explanation"}</span>
            <p>{page.explanation}</p>
          </div>
          <Button size="sm" onClick={onNext} className="w-full gap-1.5">
            <span>Continue to Next Slide</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
