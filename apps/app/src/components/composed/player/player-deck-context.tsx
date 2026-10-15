import { createContext, useCallback, useContext, useMemo, useState } from "react"

/**
 * Deck navigation state shared between the player shell's steps sidebar
 * and the interactive slide viewer — the gamatutor-ng player's sidebar
 * model: modules are steps the learner walks in order, with an active
 * step, done steps behind it, and forward modules locked until reached.
 * `furthest` persists in sessionStorage so a reload keeps the learner's
 * place without inventing a server-side resume model.
 */
export interface DeckModuleStep {
  id: string
  label: string
}

interface PlayerDeckContextValue {
  modules: DeckModuleStep[]
  activeModuleId: string | null
  furthestModuleIdx: number
  /** The viewer reports every slide it lands on. */
  onSlideChange: (moduleId: string, moduleIdx: number) => void
  /** The pending sidebar jump request (nonce increments per click so
   *  same-module repeats still retrigger) — the viewer navigates on it. */
  requestJump: (moduleId: string) => void
  jump: { moduleId: string; nonce: number } | null
}

const PlayerDeckContext = createContext<PlayerDeckContextValue | null>(null)

function storageKey(courseId: string) {
  return `lms.deck-progress.${courseId}`
}

export function PlayerDeckProvider({
  courseId,
  modules,
  children,
}: {
  courseId: string
  modules: DeckModuleStep[]
  children: React.ReactNode
}) {
  const [activeModuleId, setActiveModuleId] = useState<string | null>(modules[0]?.id ?? null)
  const [furthestModuleIdx, setFurthestModuleIdx] = useState(() => {
    try {
      const raw = sessionStorage.getItem(storageKey(courseId))
      const idx = raw == null ? NaN : Number(raw)
      return Number.isInteger(idx) && idx >= 0 && idx < modules.length ? idx : 0
    } catch {
      return 0
    }
  })
  const [jump, setJump] = useState<{ moduleId: string; nonce: number } | null>(null)

  const onSlideChange = useCallback(
    (moduleId: string, moduleIdx: number) => {
      setActiveModuleId(moduleId)
      setFurthestModuleIdx((prev) => {
        const next = Math.max(prev, moduleIdx)
        try {
          sessionStorage.setItem(storageKey(courseId), String(next))
        } catch {
          // Session storage blocked — progress just won't survive a reload.
        }
        return next
      })
    },
    [courseId]
  )

  const requestJump = useCallback((moduleId: string) => {
    setJump({ moduleId, nonce: Date.now() })
  }, [])

  const value = useMemo(
    () => ({ modules, activeModuleId, furthestModuleIdx, onSlideChange, requestJump, jump }),
    [modules, activeModuleId, furthestModuleIdx, onSlideChange, requestJump, jump]
  )

  return <PlayerDeckContext.Provider value={value}>{children}</PlayerDeckContext.Provider>
}

export function usePlayerDeck(): PlayerDeckContextValue | null {
  return useContext(PlayerDeckContext)
}
