import { useEffect, useState } from "react"
import { Link, useLocation, useMatchRoute } from "@tanstack/react-router"
import { Eye, Menu } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Progress } from "@workspace/ui/components/progress"
import { Separator } from "@workspace/ui/components/separator"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@workspace/ui/components/sheet"
import type { ContractCourse } from "@workspace/contracts/domain"

import { BackLink } from "@/components/composed/_shared/back-link"
import { TabNav, tabNavItemProps } from "@/components/composed/_shared/tab-nav"
import { LessonCheck } from "@/components/composed/player/_atoms/lesson-check"
import { DeckSteps } from "@/components/composed/player/_atoms/deck-steps"
import type { CourseDefinition } from "@/lib/content/course-types"

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
  deckCourse,
  children,
}: {
  course: ContractCourse
  completedLessonIds: string[]
  /** Present on decked courses — swaps the outline + tab chrome for the
   *  gamatutor-ng steps sidebar and a chrome-less main area. */
  deckCourse?: CourseDefinition | null
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
      <aside className={deckCourse ? "hidden w-[280px] shrink-0 lg:block" : "hidden w-80 shrink-0 border-e lg:block"}>
        <div className="sticky top-0 flex h-svh flex-col overflow-hidden">
          {deckCourse ? (
            <DeckSteps course={deckCourse} />
          ) : (
            <CourseOutline course={course} completedLessonIds={completedLessonIds} />
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {deckCourse ? (
          <Sheet open={outlineOpen} onOpenChange={setOutlineOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Langkah Modul"
                  className="absolute start-4 top-3 z-30 text-[#173a5e] hover:bg-[#173a5e]/10 lg:hidden"
                />
              }
            >
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <SheetTitle className="sr-only">Langkah Modul</SheetTitle>
              <div className="flex h-full flex-col overflow-hidden">
                <DeckSteps course={deckCourse} />
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <header className="flex items-center gap-2 border-b border-sky-800/40 bg-[#0369a1] px-4 text-white lg:px-6 dark:border-sky-900/60 dark:bg-[#082f49]">
            <Sheet open={outlineOpen} onOpenChange={setOutlineOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Course Outline"
                    className="text-white hover:bg-white/10 hover:text-white lg:hidden"
                  />
                }
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

            <TabNav className="flex-1 border-b-0 [&_[aria-current=page]]:text-white [&_[aria-current=page]]:after:bg-white [&_a]:text-sky-100 [&_a:hover]:text-white">
              <Link
                to="/learn/$courseId"
                params={params}
                {...tabNavItemProps(!!matchRoute({ to: "/learn/$courseId", params, fuzzy: false }))}
              >
                Pelajaran
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
                Kuis
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
                Pengumuman
              </Link>
            </TabNav>
          </header>
        )}
        <main
          className={
            deckCourse
              ? "flex flex-1 flex-col overflow-y-auto bg-[#eef1f4] p-4 pt-12 md:p-[26px_30px] lg:pt-[26px] dark:bg-background"
              : "flex-1 overflow-y-auto"
          }
        >
          <div className={deckCourse ? "flex w-full flex-1 flex-col" : "mx-auto max-w-5xl px-4 py-8 lg:px-6"}>
            {children}
          </div>
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
      <div className="space-y-3 p-4 pe-12 lg:pe-4">
        <BackLink to="/dashboard" label="Kembali ke Dasbor" />
        <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
          <span className="flex size-5 items-center justify-center rounded-full bg-[#0d9488]/15 text-[#0d9488] dark:text-[#14b8a6]">
            <Eye className="size-3.5 stroke-[2.2]" />
          </span>
          <span className="font-extrabold text-[#0369a1] dark:text-sky-400">DRIVE Initiative</span>
        </div>
        <h2 className="line-clamp-2 leading-snug font-semibold">{course.title}</h2>
        {totalLessons > 0 ? (
          <div className="space-y-1.5 pt-1">
            <Progress
              value={percent}
              aria-label="Course progress"
              className="h-2 [&_[data-slot=progress-indicator]]:bg-[#0d9488]"
            />
            <p className="text-xs text-muted-foreground">
              {completed.size} dari {totalLessons} pelajaran selesai ({percent}%)
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
