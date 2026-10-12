import { useEffect, useRef, useState } from "react"
import { Clock } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

export interface QuizTimerProps {
  startedAt: string
  timeLimitMinutes: number
  onExpire: () => void
  className?: string
}

/**
 * Live-ticking quiz countdown timer.
 * Calculates remaining time based on attempt start time and minutes limit.
 * Pulled into an atom so both course quizzes and questionnaire assessments share it.
 */
export function QuizTimer({ startedAt, timeLimitMinutes, onExpire, className }: QuizTimerProps) {
  const targetTime = useRef(new Date(startedAt).getTime() + timeLimitMinutes * 60_000).current
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, targetTime - Date.now()))
  const hasExpiredRef = useRef(false)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    if (targetTime <= Date.now()) {
      setRemainingMs(0)
      if (!hasExpiredRef.current) {
        hasExpiredRef.current = true
        onExpireRef.current()
      }
      return
    }

    const interval = setInterval(() => {
      const diff = Math.max(0, targetTime - Date.now())
      setRemainingMs(diff)
      if (diff <= 0) {
        clearInterval(interval)
        if (!hasExpiredRef.current) {
          hasExpiredRef.current = true
          onExpireRef.current()
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [targetTime])

  const totalSeconds = Math.floor(remainingMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const formattedTime =
    hours > 0
      ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`

  const isLowTime = totalSeconds > 0 && totalSeconds < 120 // < 2 minutes remaining

  return (
    <Badge
      variant={isLowTime ? "destructive" : "outline"}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 font-mono text-xs md:text-sm",
        isLowTime && "animate-pulse font-semibold",
        className
      )}
      aria-label={`Sisa waktu: ${formattedTime}`}
    >
      <Clock className="size-3.5 shrink-0" />
      <span>Sisa Waktu: {formattedTime}</span>
    </Badge>
  )
}
