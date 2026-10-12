import { useEffect, useState } from "react"
import { Link, useLocation, useMatchRoute } from "@tanstack/react-router"
import { Menu } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Progress } from "@workspace/ui/components/progress"
import { Separator } from "@workspace/ui/components/separator"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@workspace/ui/components/sheet"
import type { ContractCourse } from "@workspace/contracts/domain"

import { BackLink } from "@/components/composed/_shared/back-link"
import { TabNav, tabNavItemProps } from "@/components/composed/_shared/tab-nav"
import { LessonCheck } from "@/components/composed/player/_atoms/lesson-check"

/**
 * Chrome-less course player. The lesson outline lives in a fixed sidebar
 * from `lg` up and in a sheet below it — it used to be `hidden lg:block`
 * with nothing in its place, which left a phone learner with no outline,
 * no lesson-to-lesson navigation, and (because the only "Kembali ke
 * Dasbor" link lived in that sidebar) no way out of the player at all.
 */
export function PlayerShell({
  course,
  completedLessonIds,
  children,
}: {
  course: ContractCourse
  completedLessonIds: string[]
  children: React.ReactNode
}) {
  const [outlineOpen, setOutlineOpen] = useState(false)
  const location = useLocation()
  const matchRoute = useMatchRoute()
  const params = { courseId: course.id }

  // Navigating from inside the sheet should close it.
  useEffect(() => setOutlineOpen(false), [location.pathname])

  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-80 shrink-0 border-e lg:block">
        <div className="sticky top-0 flex h-svh flex-col overflow-hidden">
          <CourseOutline course={course} completedLessonIds={completedLessonIds} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b px-4 lg:px-6">
          <Sheet open={outlineOpen} onOpenChange={setOutlineOpen}>
            <SheetTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label="Course Outline" className="lg:hidden" />}
            >
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0">
              <SheetTitle className="sr-only">Course Outline</SheetTitle>
              <div className="flex h-full flex-col overflow-hidden">
                <CourseOutline course={course} completedLessonIds={completedLessonIds} />
              </div>
            </SheetContent>
          </Sheet>

          <TabNav className="flex-1 border-b-0">
            <Link
              to="/learn/$courseId"
              params={params}
              {...tabNavItemProps(!!matchRoute({ to: "/learn/$courseId", params, fuzzy: false }))}
            >
              Lessons
            </Link>
            <Link
              to="/learn/$courseId/quizzes"
              params={params}
              {...tabNavItemProps(
                !!matchRoute({
                  to: "/learn/$courseId/quizzes",
                  params,
                  fuzzy: true,
                })
              )}
            >
              Quizzes
            </Link>
            <Link
              to="/learn/$courseId/assignments"
              params={params}
              {...tabNavItemProps(
                !!matchRoute({
                  to: "/learn/$courseId/assignments",
                  params,
                  fuzzy: true,
                })
              )}
            >
              Assignments
            </Link>
            <Link
              to="/learn/$courseId/attendance"
              params={params}
              {...tabNavItemProps(
                !!matchRoute({
                  to: "/learn/$courseId/attendance",
                  params,
                  fuzzy: true,
                })
              )}
            >
              Attendance
            </Link>
            <Link
              to="/learn/$courseId/discussions"
              params={params}
              {...tabNavItemProps(
                !!matchRoute({
                  to: "/learn/$courseId/discussions",
                  params,
                  fuzzy: true,
                })
              )}
            >
              Discussions
            </Link>
            <Link
              to="/learn/$courseId/pengumuman"
              params={params}
              {...tabNavItemProps(
                !!matchRoute({
                  to: "/learn/$courseId/pengumuman",
                  params,
                  fuzzy: true,
                })
              )}
            >
              Announcements
            </Link>
          </TabNav>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-8 lg:px-6">{children}</div>
        </main>
      </div>
    </div>
  )
}

/** The lesson outline, shared by the sidebar and the mobile sheet. */
function CourseOutline({ course, completedLessonIds }: { course: ContractCourse; completedLessonIds: string[] }) {
  const completed = new Set(completedLessonIds)
  const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0)
  const percent = totalLessons === 0 ? 0 : Math.round((completed.size / totalLessons) * 100)

  return (
    <>
      <div className="space-y-2 p-4 pe-12 lg:pe-4">
        <BackLink to="/dashboard" label="Back to Dashboard" />
        <h2 className="line-clamp-2 leading-snug font-semibold">{course.title}</h2>
        {totalLessons > 0 ? (
          <div className="space-y-1.5">
            <Progress value={percent} aria-label="Course progress" />
            <p className="text-xs text-muted-foreground">
              {completed.size} of {totalLessons} lessons completed
            </p>
          </div>
        ) : null}
      </div>
      <Separator />
      <nav className="flex-1 space-y-4 overflow-y-auto p-2">
        {course.modules.map((module, mi) => (
          <div key={module.id}>
            <p className="mb-1 px-2 text-xs font-medium text-muted-foreground">
              {mi + 1}. {module.title}
            </p>
            <ul>
              {module.lessons.map((lesson) => (
                <li key={lesson.id}>
                  <LessonLink
                    courseId={course.id}
                    lessonId={lesson.id}
                    title={lesson.title}
                    done={completed.has(lesson.id)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  )
}

function LessonLink({
  courseId,
  lessonId,
  title,
  done,
}: {
  courseId: string
  lessonId: string
  title: string
  done: boolean
}) {
  return (
    <Link
      to="/learn/$courseId/lesson/$lessonId"
      params={{ courseId, lessonId }}
      activeOptions={{ exact: true }}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-muted data-[status=active]:bg-accent data-[status=active]:text-accent-foreground"
    >
      <LessonCheck done={done} className="size-4 shrink-0" />
      <span className="line-clamp-1">{title}</span>
    </Link>
  )
}
