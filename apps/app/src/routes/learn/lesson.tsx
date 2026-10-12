import { Link, useNavigate, useParams } from "@tanstack/react-router"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowLeft, ArrowRight, Check } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"

import { useCourseContext } from "@/components/composed/player/course-context"
import { EmptyState } from "@/components/composed/_shared/empty-state"
import { InteractiveSlideViewer } from "@/components/composed/player/interactive-slide-viewer"
import { apiSend } from "@/lib/api"
import { DRIVE_RETINOPATHY_COURSE } from "@/lib/content/drive-retinopati-data"

interface VideoEmbed {
  kind: "iframe" | "video"
  src: string
}

function getVideoEmbed(rawUrl: string): VideoEmbed {
  const url = rawUrl.trim()

  // YouTube: handles watch?v=xxx, youtu.be/xxx, embed/xxx, shorts/xxx, and query parameters
  const ytMatch = url.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
  )
  if (ytMatch) {
    return {
      kind: "iframe",
      src: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?rel=0`,
    }
  }

  // Vimeo: handles vimeo.com/123456
  const vimeoMatch = url.match(
    /(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/[^/]+\/videos\/|album\/\d+\/video\/|video\/|))(\d+)/
  )
  if (vimeoMatch) {
    return {
      kind: "iframe",
      src: `https://player.vimeo.com/video/${vimeoMatch[1]}?dnt=1`,
    }
  }

  return { kind: "video", src: url }
}

export function LessonPage() {
  const { lessonId } = useParams({ from: "/learn/$courseId/lesson/$lessonId" })
  const navigate = useNavigate()
  const { course, completedLessonIds, refreshProgress } = useCourseContext()

  const lesson = course.modules.flatMap((m) => m.lessons).find((l) => l.id === lessonId)
  const isCompleted = completedLessonIds.includes(lessonId)

  const isDriveCourse =
    course.title.toLowerCase().includes("retinopati") ||
    course.title.toLowerCase().includes("drive") ||
    course.id.toLowerCase().includes("drive")

  const toggleComplete = useMutation({
    mutationFn: () =>
      isCompleted
        ? apiSend<null>("DELETE", `/lesson-progress/${lessonId}/complete`)
        : apiSend<null>("POST", `/lesson-progress/${lessonId}/complete?courseId=${encodeURIComponent(course.id)}`),
    onSuccess: async () => {
      toast.success(isCompleted ? "Lesson marked incomplete" : "Lesson completed")
      await refreshProgress()
    },
    onError: () => toast.error("Failed to update progress"),
  })

  const completeAndAdvance = useMutation({
    mutationFn: async () => {
      await apiSend<null>("POST", `/lesson-progress/${lessonId}/complete?courseId=${encodeURIComponent(course.id)}`)
    },
    onSuccess: async () => {
      toast.success("Lesson completed")
      await refreshProgress()
      if (next) {
        void navigate({
          to: "/learn/$courseId/lesson/$lessonId",
          params: { courseId: course.id, lessonId: next.id },
        })
      }
    },
    onError: () => toast.error("Failed to update progress"),
  })

  if (!lesson) {
    return <p className="py-8 text-center text-muted-foreground">Lesson not found.</p>
  }

  const allLessons = course.modules.flatMap((m) => m.lessons)
  const idx = allLessons.findIndex((l) => l.id === lessonId)
  const previous = idx > 0 ? allLessons[idx - 1] : undefined
  const next = allLessons[idx + 1]

  return (
    <article className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{lesson.title}</h1>
        {lesson.description ? <p className="text-sm text-muted-foreground">{lesson.description}</p> : null}
      </div>

      <div className="min-h-64">
        {isDriveCourse ? (
          <InteractiveSlideViewer
            course={DRIVE_RETINOPATHY_COURSE}
            onCompleteModule={() => {
              if (!isCompleted) {
                completeAndAdvance.mutate()
              }
            }}
          />
        ) : lesson.contentType === "text" && lesson.textContent ? (
          <div className="max-w-prose text-sm leading-relaxed whitespace-pre-line">{lesson.textContent}</div>
        ) : lesson.contentType === "video" && lesson.url ? (
          <div className="aspect-video overflow-hidden rounded-lg border bg-black shadow-xs">
            {(() => {
              const media = getVideoEmbed(lesson.url)
              if (media.kind === "iframe") {
                return (
                  <iframe
                    src={media.src}
                    className="size-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    title={lesson.title}
                  />
                )
              }
              return <video src={media.src} controls className="size-full" />
            })()}
          </div>
        ) : (
          <EmptyState
            title="Content not yet available"
            description="The instructor has not published materials for this lesson yet."
          />
        )}
      </div>

      <Separator />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {!isCompleted && next ? (
            <Button
              onClick={() => completeAndAdvance.mutate()}
              disabled={completeAndAdvance.isPending}
              className="gap-2"
            >
              <Check className="size-4" />
              {completeAndAdvance.isPending ? "Saving..." : "Complete & Advance"}
            </Button>
          ) : (
            <Button
              variant={isCompleted ? "outline" : "default"}
              onClick={() => toggleComplete.mutate()}
              disabled={toggleComplete.isPending}
            >
              {toggleComplete.isPending ? "Saving..." : isCompleted ? "Mark Incomplete" : "Mark Complete"}
            </Button>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-3">
          {previous ? (
            <Link
              to="/learn/$courseId/lesson/$lessonId"
              params={{ courseId: course.id, lessonId: previous.id }}
              className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5 shrink-0" />
              <span className="truncate">Previous</span>
            </Link>
          ) : null}
          {next ? (
            <Link
              to="/learn/$courseId/lesson/$lessonId"
              params={{ courseId: course.id, lessonId: next.id }}
              className="flex min-w-0 items-center gap-1 text-sm text-primary hover:underline"
              title={next.title}
            >
              <span className="truncate">Next: {next.title}</span>
              <ArrowRight className="size-3.5 shrink-0" />
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  )
}
