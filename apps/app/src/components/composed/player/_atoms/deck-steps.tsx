import { Link } from "@tanstack/react-router"
import { ArrowLeft, Check, Clock, Lock, Play } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { DriveLogo } from "@/components/composed/_shared/drive-logo"
import { usePlayerDeck } from "@/components/composed/player/player-deck-context"
import type { DeckModuleStep } from "@/components/composed/player/player-deck-context"
import type { CourseDefinition } from "@/lib/content/course-types"

/**
 * The gamatutor-ng steps sidebar: a gradient head (back link, brand,
 * course title) over the deck's steps. A step is a deck module; steps
 * sharing a `group` ("Modul 1") nest under one numbered heading, so the
 * outline reads Pengantar Umum · Pre Test · Modul 1 (Pengantar, BAB 1–3,
 * Evaluasi) · … · Post Test · Selesai — the order the DRIVE team set on
 * 29 Okt 2026. Each step has a play circle that flips to a check once
 * the learner is past it and a lock while it is still ahead of their
 * furthest reached step; placeholder steps (announced, not yet written)
 * stay greyed out. Clicking an unlocked step jumps the slide viewer.
 */
export function DeckSteps({ course }: { course: CourseDefinition }) {
  const deck = usePlayerDeck()
  if (!deck) return null
  const { modules, activeModuleId, furthestModuleIdx, requestJump } = deck

  // Consecutive steps with the same group collapse under one heading.
  const rows: Array<{ group: string | null; steps: Array<{ step: DeckModuleStep; index: number }> }> = []
  modules.forEach((step, index) => {
    const last = rows[rows.length - 1]
    if (step.group && last?.group === step.group) last.steps.push({ step, index })
    else rows.push({ group: step.group ?? null, steps: [{ step, index }] })
  })

  function stepState(step: DeckModuleStep, index: number) {
    return {
      active: step.id === activeModuleId,
      done: !step.placeholder && index < furthestModuleIdx,
      locked: !step.placeholder && index > furthestModuleIdx,
    }
  }

  return (
    <>
      <div className="bg-gradient-to-br from-[#5bb4b2] via-[#2d77c2] to-[#173a5e] p-4 text-white">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          className="-ms-2.5 h-8 gap-2 px-2.5 text-xs font-medium text-white/90 hover:bg-white/15 hover:text-white"
          render={<Link to="/dashboard" />}
        >
          <ArrowLeft className="size-4" />
          <span>Kembali ke Dasbor</span>
        </Button>
        <div className="mt-3">
          <DriveLogo onDark logoClassName="h-6" />
        </div>
        <h2 className="mt-2.5 line-clamp-3 text-[15px] leading-snug font-bold">{course.title}</h2>
      </div>
      <nav aria-label="Langkah modul" className="flex-1 overflow-y-auto">
        <ol>
          {rows.map((row, rowIdx) => {
            if (!row.group) {
              const { step, index } = row.steps[0]
              return (
                <li key={step.id}>
                  <StepButton
                    number={rowIdx + 1}
                    step={step}
                    {...stepState(step, index)}
                    onClick={() => requestJump(step.id)}
                  />
                </li>
              )
            }
            const groupActive = row.steps.some(({ step }) => step.id === activeModuleId)
            const groupLocked = row.steps.every(({ step, index }) => step.placeholder || index > furthestModuleIdx)
            return (
              <li key={row.group}>
                <div
                  className={cn(
                    "flex items-center gap-3 border-b border-[#cfcfcf] px-4 py-2.5 text-[13.5px] font-bold",
                    groupActive
                      ? "bg-[#e3eef9] text-[#173a5e]"
                      : groupLocked
                        ? "bg-[#dcdcdc] text-[#8b8b8b]"
                        : "bg-background"
                  )}
                >
                  <span className="w-4 shrink-0 text-right">{rowIdx + 1}</span>
                  <span className="tracking-wide uppercase">{row.group}</span>
                </div>
                <ol>
                  {row.steps.map(({ step, index }) => (
                    <li key={step.id}>
                      <StepButton nested step={step} {...stepState(step, index)} onClick={() => requestJump(step.id)} />
                    </li>
                  ))}
                </ol>
              </li>
            )
          })}
        </ol>
      </nav>
    </>
  )
}

function StepButton({
  number,
  nested = false,
  step,
  active,
  done,
  locked,
  onClick,
}: {
  number?: number
  nested?: boolean
  step: DeckModuleStep
  active: boolean
  done: boolean
  locked: boolean
  onClick: () => void
}) {
  const disabled = locked || !!step.placeholder
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={
        step.placeholder
          ? "Materi sedang disiapkan"
          : locked
            ? "Selesaikan langkah sebelumnya dulu"
            : `Buka ${step.label}`
      }
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 border-b border-[#cfcfcf] px-4 text-left font-semibold transition-[filter,background-color] duration-150",
        nested ? "py-2.5 ps-11 text-[13px]" : "py-3.5 text-[13.5px]",
        active
          ? "bg-[#2d77c2] text-white"
          : step.placeholder
            ? "cursor-not-allowed bg-[#ececec] text-[#a3a3a3]"
            : done
              ? "bg-background text-foreground/75 hover:brightness-97"
              : locked
                ? "cursor-not-allowed bg-[#dcdcdc] text-[#8b8b8b] opacity-60"
                : "bg-[#dcdcdc] text-[#8b8b8b] hover:brightness-97"
      )}
    >
      {number != null ? <span className="w-4 shrink-0 text-right font-bold">{number}</span> : null}
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full",
          nested ? "size-[22px]" : "size-[26px]",
          active
            ? "bg-white text-[#2d77c2]"
            : step.placeholder
              ? "bg-[#c4c4c4] text-white"
              : done
                ? "bg-[#2c7a4b] text-white"
                : locked
                  ? "bg-[#999] text-white"
                  : "bg-foreground text-white"
        )}
      >
        {step.placeholder ? (
          <Clock className="size-3" />
        ) : done ? (
          <Check className="size-3" />
        ) : locked ? (
          <Lock className="size-3" />
        ) : (
          <Play className="size-3 fill-current" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2">{step.label}</span>
        {step.placeholder ? <span className="block text-[11px] font-medium text-[#a3a3a3]">Segera hadir</span> : null}
      </span>
    </button>
  )
}
