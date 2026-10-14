import { useParams } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { CourseThumbnail } from "@/components/composed/courses/_atoms/course-thumbnail"
import { EmptyState } from "@/components/composed/_shared/empty-state"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { EnrollPanel } from "@/components/composed/student/enroll-panel"
import { WishlistButton } from "@/components/composed/student/wishlist-button"
import { useSession } from "@/lib/session"
import { apiGet } from "@/lib/api"
import { COURSE_TYPE_LABELS, LEVEL_LABELS } from "@/lib/labels"
import type { ContractCourse, ContractEnrollment, ContractRegisteredInstitution } from "@workspace/contracts/domain"

/**
 * Transactional course detail: the syllabus preview plus the
 * enroll/purchase panel. Marketing polish is apps/web's surface.
 */

export function CourseDetailPage() {
  const { courseId } = useParams({ from: "/workspace/learner/courses/$courseId" })
  const session = useSession()
  const user = session.data ?? null

  const course = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => apiGet<ContractCourse>(`/courses/${courseId}`),
  })

  const institution = useQuery({
    queryKey: ["institution", course.data?.institutionId],
    queryFn: () => apiGet<ContractRegisteredInstitution>(`/institutions/${course.data?.institutionId}`),
    enabled: course.data != null,
  })

  const myEnrollment = useQuery({
    queryKey: ["my-enrollment", courseId, user?.id],
    queryFn: () => apiGet<ContractEnrollment[]>(`/enrollments?courseId=${courseId}&userId=${user?.id}&pageSize=10`),
    enabled: user != null,
    select: (rows) => rows.find((row) => row.userId === user?.id) ?? null,
  })

  if (course.isLoading || !course.data) {
    return (
      <div className="space-y-6">
        <PageHeader backTo="/courses" backLabel="Catalog" />
        {course.isLoading ? (
          <>
            <Skeleton className="aspect-video w-full rounded-xl sm:aspect-[21/9] sm:max-h-80" />
            <div className="grid gap-6 lg:grid-cols-3">
              <Skeleton className="h-64 w-full lg:col-span-2" />
              <Skeleton className="h-40 w-full" />
            </div>
          </>
        ) : course.isError ? (
          <ErrorState error={course.error} onRetry={() => void course.refetch()} />
        ) : (
          <EmptyState title="Course not found" />
        )}
      </div>
    )
  }

  const c = course.data

  return (
    <div className="space-y-6">
      <PageHeader backTo="/courses" backLabel="Catalog" title={c.title} description={c.shortDescription ?? undefined} />

      <CourseThumbnail
        thumbnail={c.thumbnail}
        placeholder={false}
        className="aspect-video w-full rounded-xl sm:aspect-[21/9] sm:max-h-80"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{COURSE_TYPE_LABELS[c.courseType] ?? c.courseType}</Badge>
                <Badge variant="outline">{LEVEL_LABELS[c.level] ?? c.level}</Badge>
                <Badge variant="outline">{institution.data?.name ?? "—"}</Badge>
              </div>
              {c.description ? (
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{c.description}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Course Syllabus</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {c.modules.length === 0 ? (
                <EmptyState
                  compact
                  title="Syllabus not available"
                  description="The instructor has not added modules for this course yet."
                />
              ) : (
                c.modules.map((module, index) => (
                  <div key={module.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {index + 1}. {module.title}
                      </span>
                      <Badge variant="outline">{module.lessons.length} lessons</Badge>
                    </div>
                    <ul className="mt-2 divide-y divide-border">
                      {module.lessons.map((lesson, lessonIndex) => (
                        <li key={lesson.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                          <span className="truncate">
                            {lessonIndex + 1}. {lesson.title}
                          </span>
                          {lesson.isPreview ? <Badge variant="secondary">Preview</Badge> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <EnrollPanel course={c} enrollment={myEnrollment.data ?? null} />
          <WishlistButton courseId={c.id} />
        </div>
      </div>
    </div>
  )
}
