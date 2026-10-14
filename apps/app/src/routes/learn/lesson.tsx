import { Link, useNavigate, useParams } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowLeft, ArrowRight, Check } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"

import { useCourseContext } from "@/components/composed/player/course-context"
import { EmptyState } from "@/components/composed/_shared/empty-state"
import { InteractiveSlideViewer } from "@/components/composed/player/interactive-slide-viewer"
import { AudioLessonPlayer, DocumentLessonViewer } from "@/components/composed/player/_atoms/media-renderers"
import { apiGet, apiSend } from "@/lib/api"
import type { CourseDefinition } from "@/lib/content/course-types"
import type { ContractCertificate, ContractEnrollment, ContractSlideDeck } from "@workspace/contracts/domain"

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

  // A course with an attached interactive slide deck renders that deck
  // for its lessons (404 = plain lesson content). The manifest's shape
  // is owned by the player's course-types; a schemaVersion the player
  // can't render falls back to plain content rather than crashing.
  const slideDeck = useQuery({
    queryKey: ["slide-deck", course.id],
    queryFn: () => apiGet<ContractSlideDeck>(`/courses/${course.id}/slide-deck`),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
  const deckCourse: CourseDefinition | null =
    slideDeck.data && slideDeck.data.schemaVersion === 1
      ? (slideDeck.data.manifest as unknown as CourseDefinition)
      : null

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

  const claimCertificate = useMutation({
    mutationFn: async () => {
      const enrollmentsList = await apiGet<ContractEnrollment[]>(
        `/enrollments?courseId=${encodeURIComponent(course.id)}&pageSize=1`
      )
      const myEnrollment = enrollmentsList[0]
      if (!myEnrollment) {
        throw new Error("No active enrollment found to claim certificate")
      }
      return apiSend<ContractCertificate>("POST", `/courses/${course.id}/certificates`, {
        enrollmentId: myEnrollment.id,
        title: "Sertifikat Kelulusan Pelatihan Skrining Retinopati Diabetika",
        description: `Diberikan atas kelulusan pada pelatihan ${course.title} oleh Departemen Oftalmologi FK-KMK UGM.`,
      })
    },
    onSuccess: (cert) => {
      toast.success("Certificate claimed successfully!")
      void navigate({
        to: "/certificates/$certificateId",
        params: { certificateId: cert.id },
      })
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to claim certificate"
      toast.error(msg)
    },
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
        {deckCourse ? (
          <InteractiveSlideViewer
            course={deckCourse}
            postTestQuizId={slideDeck.data?.postTestQuizId}
            onCompleteModule={() => {
              if (!isCompleted) {
                completeAndAdvance.mutate()
              }
            }}
            onClaimCertificate={() => {
              claimCertificate.mutate()
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
        ) : lesson.contentType === "audio" && lesson.url ? (
          <AudioLessonPlayer url={lesson.url} title={lesson.title} />
        ) : lesson.contentType === "document" && lesson.url ? (
          <DocumentLessonViewer url={lesson.url} title={lesson.title} />
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
              {completeAndAdvance.isPending ? "Menyimpan..." : "Selesai & Lanjut"}
            </Button>
          ) : (
            <Button
              variant={isCompleted ? "outline" : "default"}
              onClick={() => toggleComplete.mutate()}
              disabled={toggleComplete.isPending}
            >
              {toggleComplete.isPending ? "Menyimpan..." : isCompleted ? "Tandai Belum Selesai" : "Tandai Selesai"}
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
              <span className="truncate">Sebelumnya</span>
            </Link>
          ) : null}
          {next ? (
            <Link
              to="/learn/$courseId/lesson/$lessonId"
              params={{ courseId: course.id, lessonId: next.id }}
              className="flex min-w-0 items-center gap-1 text-sm text-primary hover:underline"
              title={next.title}
            >
              <span className="truncate">Berikutnya: {next.title}</span>
              <ArrowRight className="size-3.5 shrink-0" />
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  )
}
