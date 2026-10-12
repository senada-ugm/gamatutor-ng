import { Link, Outlet, useParams } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { EmptyState } from "@/components/composed/_shared/empty-state"
import { PlayerShell } from "@/components/composed/player/player-shell"
import { CourseContextProvider } from "@/components/composed/player/course-context"
import { getSession } from "@/lib/auth"
import { apiGet } from "@/lib/api"
import type { ContractCourse } from "@workspace/contracts/domain"

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
          title="Pelatihan tidak ditemukan"
          description="Pelatihan ini mungkin sudah dihapus atau Anda tidak memiliki akses."
          action={
            <Button nativeButton={false} render={<Link to="/dashboard" />}>
              Kembali ke Dasbor
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <CourseContextProvider value={{ course, completedLessonIds, refreshProgress: loadProgress }}>
      <PlayerShell course={course} completedLessonIds={completedLessonIds}>
        <Outlet />
      </PlayerShell>
    </CourseContextProvider>
  )
}
