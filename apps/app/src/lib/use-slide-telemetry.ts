import { useEffect, useRef } from "react"
import { apiSend } from "@/lib/api"

interface UseSlideTelemetryOptions {
  courseId: string
  moduleId: string
  slideId: string
  enabled?: boolean
}

export function useSlideTelemetry({
  courseId,
  moduleId,
  slideId,
  enabled = true,
}: UseSlideTelemetryOptions) {
  const enterTimeRef = useRef<number>(Date.now())

  useEffect(() => {
    if (!enabled) return

    enterTimeRef.current = Date.now()

    // Send initial view event
    void apiSend("POST", "/telemetry/events", {
      courseId,
      moduleId,
      slideId,
      eventType: "view",
      dwellTimeSeconds: 0,
    }).catch(() => {
      // Non-blocking telemetry
    })

    return () => {
      const dwellSeconds = Math.max(1, Math.round((Date.now() - enterTimeRef.current) / 1000))

      // Send heartbeat / dwell event on exit
      void apiSend("POST", "/telemetry/events", {
        courseId,
        moduleId,
        slideId,
        eventType: "heartbeat",
        dwellTimeSeconds: dwellSeconds,
      }).catch(() => {
        // Non-blocking telemetry
      })
    }
  }, [courseId, moduleId, slideId, enabled])
}
