import { Link, Outlet, useParams } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { EmptyState } from "@/components/composed/_shared/empty-state"
import { PlayerShell } from "@/components/composed/player/player-shell"
import { CourseContextProvider } from "@/components/composed/player/course-context"
import { PlayerDeckProvider } from "@/components/composed/player/player-deck-context"
import type { CourseDefinition } from "@/lib/content/course-types"
import { getSession } from "@/lib/auth"
import { apiGet } from "@/lib/api"
import type { ContractCourse, ContractSlideDeck } from "@workspace/contracts/domain"

export function LearnLayout() {
  const { courseId } = useParams({ from: "/learn/$courseId" })
  const [course, setCourse] = useState<ContractCourse | null>(null)
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  async function loadProgress() {
    const session = await getSession()
    if (!session) return
    const progress = await apiGet<Array<{ lessonId: string }>>(
      `/lesson-progress?courseId=${encodeURIComponent(courseId)}&userId=${encodeURIComponent(session.id)}&pageSize=200`
    ).catch(() => [] as Array<{ lessonId: string }>)
    setCompletedLessonIds(progress.map((p) => p.lessonId))
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      const session = await getSession()
      if (!session) {
        window.location.href = "/login"
        return
      }

      try {
        const courseData = await apiGet<ContractCourse>(`/courses/${courseId}`)
        const progress = await apiGet<Array<{ lessonId: string }>>(
          `/lesson-progress?courseId=${encodeURIComponent(courseId)}&userId=${encodeURIComponent(session.id)}&pageSize=200`
        ).catch(() => [] as Array<{ lessonId: string }>)

        if (!cancelled && courseData) {
          setCourse(courseData)
          setCompletedLessonIds(progress.map((p) => p.lessonId))
        }
      } catch {
        // Course fetch failed — fall through to the not-found state.
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [courseId])

  if (loading) {
    return (
      <div className="flex min-h-svh">
        <aside className="hidden w-80 shrink-0 border-e p-4 lg:block">
          <Skeleton className="h-full w-full" />
        </aside>
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8 lg:px-6">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4">
        <EmptyState
          title="Course not found"
          description="This course may have been removed or you do not have permission to view it."
          action={
            <Button nativeButton={false} render={<Link to="/dashboard" />}>
              Back to Dashboard
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <CourseContextProvider value={{ course, completedLessonIds, refreshProgress: loadProgress }}>
      <DeckAwareShell course={course} completedLessonIds={completedLessonIds}>
        <Outlet />
      </DeckAwareShell>
    </CourseContextProvider>
  )
}

/** Resolves the course's interactive deck (cached — the lesson page's
 *  slide-deck query shares the key) and, when one exists, wraps the
 *  player in the deck navigation context and switches the shell chrome
 *  to the gamatutor-ng steps layout. */
function DeckAwareShell({
  course,
  completedLessonIds,
  children,
}: {
  course: ContractCourse
  completedLessonIds: string[]
  children: React.ReactNode
}) {
  const slideDeck = useQuery({
    queryKey: ["slide-deck", course.id],
    queryFn: () => apiGet<ContractSlideDeck>(`/courses/${course.id}/slide-deck`),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
  const deckCourse =
    slideDeck.data && slideDeck.data.schemaVersion === 1
      ? (slideDeck.data.manifest as unknown as CourseDefinition)
      : null

  if (!deckCourse) {
    return (
      <PlayerShell course={course} completedLessonIds={completedLessonIds}>
        {children}
      </PlayerShell>
    )
  }
  return (
    <PlayerDeckProvider courseId={course.id} modules={deckCourse.modules.map((m) => ({ id: m.id, label: m.label }))}>
      <PlayerShell course={course} completedLessonIds={completedLessonIds} deckCourse={deckCourse}>
        {children}
      </PlayerShell>
    </PlayerDeckProvider>
  )
}
