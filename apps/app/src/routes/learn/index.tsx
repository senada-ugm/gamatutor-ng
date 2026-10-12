import { Link } from "@tanstack/react-router"

import { Button } from "@workspace/ui/components/button"

import { EmptyState } from "@/components/composed/_shared/empty-state"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { useCourseContext } from "@/components/composed/player/course-context"
import { LessonCheck } from "@/components/composed/player/_atoms/lesson-check"

/**
 * The player's landing tab. On `lg` this sits next to a sidebar that
 * already lists every lesson, so the page's job is the one thing the
 * sidebar can't do: get the learner into the right lesson in one click.
 * The outline stays because below `lg` the sidebar is a sheet.
 */
export function LearnIndex() {
  const { course, completedLessonIds } = useCourseContext()
  const completed = new Set(completedLessonIds)
  const allLessons = course.modules.flatMap((m) => m.lessons)
  const totalLessons = allLessons.length
  const nextLesson = allLessons.find((lesson) => !completed.has(lesson.id))
  const started = completed.size > 0

  if (totalLessons === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={course.title} />
        <EmptyState
          title="Content not yet available"
          description="The instructor has not added any lessons to this course yet."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={course.title}
        description={`${completed.size} of ${totalLessons} lessons completed`}
        actions={
          nextLesson ? (
            <Button
              nativeButton={false}
              render={
                <Link
                  to="/learn/$courseId/lesson/$lessonId"
                  params={{ courseId: course.id, lessonId: nextLesson.id }}
                />
              }
            >
              {started ? "Continue Learning" : "Start Learning"}
            </Button>
          ) : null
        }
      />
      <nav className="space-y-6">
        {course.modules.map((module, mi) => (
          <section key={module.id}>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">
              {mi + 1}. {module.title}
            </h2>
            <ul className="space-y-1">
              {module.lessons.map((lesson) => (
                <li key={lesson.id}>
                  <Link
                    to="/learn/$courseId/lesson/$lessonId"
                    params={{ courseId: course.id, lessonId: lesson.id }}
                    className="flex items-center gap-3 rounded-md border p-3 text-sm transition-colors hover:bg-muted"
                  >
                    <LessonCheck done={completed.has(lesson.id)} className="size-5 shrink-0" />
                    <span className="min-w-0 flex-1">{lesson.title}</span>
                    {lesson.duration ? (
                      <span className="shrink-0 text-xs text-muted-foreground">{lesson.duration} min</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
    </div>
  )
}
