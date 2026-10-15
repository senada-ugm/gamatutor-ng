import { Link } from "@tanstack/react-router"
import { ArrowLeft, Check, Lock, Play } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

import { usePlayerDeck } from "@/components/composed/player/player-deck-context"
import type { CourseDefinition } from "@/lib/content/course-types"

/**
 * The gamatutor-ng steps sidebar: a gradient head (back link, brand,
 * course title) over one full-width row per deck module — numbered,
 * with a play circle that flips to a check when the module is behind
 * the learner and a lock when it is still ahead of their furthest
 * reached module. Clicking an unlocked step jumps the slide viewer.
 */
export function DeckSteps({ course }: { course: CourseDefinition }) {
  const deck = usePlayerDeck()
  if (!deck) return null
  const { modules, activeModuleId, furthestModuleIdx, requestJump } = deck

  return (
    <>
      <div className="bg-gradient-to-br from-[#5bb4b2] via-[#2d77c2] to-[#173a5e] p-4 text-white">
        <Link
          to="/dashboard"
          className="inline-flex min-h-8 items-center gap-1.5 text-[13px] opacity-90 transition-opacity hover:underline hover:opacity-100"
        >
          <ArrowLeft className="size-3.5" />
          Kembali ke Dasbor
        </Link>
        <div className="mt-3 flex items-center gap-2">
          <span className="flex size-[26px] items-center justify-center rounded-full border-2 border-white/90 bg-white/10 text-[13px]">
            {course.brand?.mark || "👁"}
          </span>
          <span className="text-[13px] font-bold tracking-wide">{course.brand?.name || "DRIVE Initiative"}</span>
        </div>
        <h2 className="mt-2 line-clamp-3 text-[15px] leading-snug font-bold">{course.title}</h2>
      </div>
      <nav aria-label="Langkah modul" className="flex-1 overflow-y-auto">
        <ol>
          {modules.map((module, i) => {
            const active = module.id === activeModuleId
            const done = i < furthestModuleIdx
            const locked = i > furthestModuleIdx
            return (
              <li key={module.id}>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => requestJump(module.id)}
                  title={locked ? "Selesaikan modul sebelumnya dulu" : `Buka ${module.label}`}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 border-b border-[#cfcfcf] px-4 py-3.5 text-left text-[13.5px] font-semibold transition-[filter,background-color] duration-150",
                    active
                      ? "bg-[#2d77c2] text-white"
                      : done
                        ? "bg-background text-foreground/75 hover:brightness-97"
                        : locked
                          ? "cursor-not-allowed bg-[#dcdcdc] text-[#8b8b8b] opacity-60"
                          : "bg-[#dcdcdc] text-[#8b8b8b] hover:brightness-97"
                  )}
                >
                  <span className="w-4 shrink-0 text-right font-bold">{i + 1}</span>
                  <span
                    className={cn(
                      "flex size-[26px] shrink-0 items-center justify-center rounded-full",
                      active
                        ? "bg-white text-[#2d77c2]"
                        : done
                          ? "bg-[#2c7a4b] text-white"
                          : locked
                            ? "bg-[#999] text-white"
                            : "bg-foreground text-white"
                    )}
                  >
                    {done ? (
                      <Check className="size-3" />
                    ) : locked ? (
                      <Lock className="size-3" />
                    ) : (
                      <Play className="size-3 fill-current" />
                    )}
                  </span>
                  <span className="line-clamp-2">{module.label}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
    </>
  )
}
