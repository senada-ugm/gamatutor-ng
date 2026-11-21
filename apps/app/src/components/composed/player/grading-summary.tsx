import { ArrowRight, CheckCircle2, CircleDashed, RotateCcw, XCircle } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Progress } from "@workspace/ui/components/progress"
import type { GradingSummaryPage, ImageGradingPage } from "@/lib/content/course-types"

interface GradingSummaryProps {
  page: GradingSummaryPage
  /** The level's summary-feedback cases, in deck order. */
  cases: ImageGradingPage[]
  /** Page id -> the option the learner picked. */
  answers: Record<string, string>
  /** Clear this level's answers and go back to its first case. */
  onRetake: () => void
  onNext: () => void
}

/**
 * "Hasil Evaluasi Simulasi Level 1/2" (Modul 4 v5.1): the score, plus the
 * answer key and the deck's explanation for every case of the level. Scored
 * locally, like a module Evaluasi: it never decides graduation.
 */
export function GradingSummary({ page, cases, answers, onRetake, onNext }: GradingSummaryProps) {
  const correct = cases.filter((c) => answers[c.id] === c.correct).length
  const answered = cases.filter((c) => answers[c.id] != null).length
  const percent = cases.length ? Math.round((correct / cases.length) * 100) : 0

  return (
    <div className="animate-in space-y-6 fade-in">
      <div className="space-y-1.5">
        <Badge
          variant="outline"
          className="border-primary/20 bg-primary/5 font-mono text-xs font-bold text-primary uppercase"
        >
          {page.level}
        </Badge>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{page.title}</h2>
        <div className="h-0.5 w-full bg-gradient-to-r from-primary via-primary/40 to-transparent" />
      </div>

      <div className="flex flex-wrap items-center gap-6 rounded-xl border bg-muted/20 p-5">
        <div>
          <div className="text-4xl font-extrabold tracking-tight text-primary">
            {correct}
            <span className="text-xl text-muted-foreground"> / {cases.length}</span>
          </div>
          <div className="text-xs text-muted-foreground">jawaban tepat · skor {percent}</div>
        </div>
        <div className="min-w-[200px] flex-1 space-y-2">
          <Progress value={percent} />
          {answered < cases.length && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {cases.length - answered} kasus belum dijawab dan dihitung salah.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onRetake} className="gap-2">
            <RotateCcw className="size-4" />
            Ulangi Level
          </Button>
          <Button onClick={onNext} className="gap-2">
            Lanjut
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>

      <ol className="space-y-3">
        {cases.map((c, idx) => {
          const answer = answers[c.id]
          const ok = answer === c.correct
          return (
            <li key={c.id} className="flex gap-4 rounded-xl border p-3 sm:p-4">
              <img
                src={c.image}
                alt={`Foto fundus kasus ${c.case ?? idx + 1}`}
                loading="lazy"
                className="size-24 shrink-0 rounded-lg bg-black object-contain sm:size-28"
              />
              <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">Kasus {c.case ?? idx + 1}</span>
                  {answer == null ? (
                    <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400">
                      <CircleDashed className="size-3" />
                      Belum dijawab
                    </Badge>
                  ) : ok ? (
                    <Badge
                      variant="outline"
                      className="gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                    >
                      <CheckCircle2 className="size-3" />
                      Tepat
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 border-red-500/40 text-red-700 dark:text-red-400">
                      <XCircle className="size-3" />
                      Kurang tepat
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Jawaban Anda: <span className="font-medium text-foreground">{answer ?? "–"}</span>
                  {" · "}Kunci: <span className="font-medium text-foreground">{c.correct}</span>
                  {c.grade ? ` (${c.grade})` : ""}
                </p>
                <p className="text-xs leading-relaxed text-foreground/85">{c.reasoning}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
