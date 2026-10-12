import { Fragment } from "react"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { CourseStatusBadge } from "@/components/composed/courses/_atoms/course-status-badge"
import { CourseThumbnail } from "@/components/composed/courses/_atoms/course-thumbnail"
import { EmptyState } from "@/components/composed/_shared/empty-state"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { ALL_INSTITUTIONS, useAuthoringScope } from "@/lib/authoring-institution"
import { useSession } from "@/lib/session"
import { apiGet } from "@/lib/api"
import type { ContractCourse } from "@workspace/contracts/domain"

export function InstructorCoursesPage() {
  const session = useSession()
  const user = session.data ?? null

  // Which institutions this account may manage, and which one it is
  // currently scoped to — see lib/authoring-institution.ts.
  const scope = useAuthoringScope()
  const ownedIds = scope.institutions.map((i) => i.id)
  const institutionNames = new Map(scope.institutions.map((i) => [i.id, i.name]))
  // The list is scoped to the selected institution; an admin's default
  // ALL_INSTITUTIONS scope keeps the platform-wide view.
  const listedIds = scope.scopeId === ALL_INSTITUTIONS || scope.scopeId == null ? ownedIds : [scope.scopeId]

  // A pure course-instructor (teaching someone else's course, no
  // institution ownership) discovers their courses through their
  // assignments — mine returns courseId rows.
  const myAssignments = useQuery({
    queryKey: ["course-instructors-mine", user?.id],
    queryFn: () => apiGet<Array<{ courseId: string }>>(`/course-instructors/mine?pageSize=100`),
    enabled: user != null,
  })
  const assignedCourseIds = [...new Set((myAssignments.data ?? []).map((a) => a.courseId))]

  const courses = useQuery({
    queryKey: ["courses", "managed", user?.role, scope.scopeId, listedIds.join(","), assignedCourseIds.join(",")],
    queryFn: async () => {
      const perInstitution =
        user?.role === "admin" && scope.scopeId === ALL_INSTITUTIONS
          ? [await apiGet<ContractCourse[]>(`/courses?pageSize=100`)]
          : await Promise.all(
              listedIds.map((id) => apiGet<ContractCourse[]>(`/courses?institutionId=${id}&pageSize=100`))
            )
      const perAssignment = await Promise.all(
        assignedCourseIds.map((id) => apiGet<ContractCourse>(`/courses/${id}`).catch(() => null))
      )
      const seen = new Set<string>()
      return [...perInstitution.flat(), ...perAssignment.filter((c): c is ContractCourse => c != null)].filter((c) => {
        if (seen.has(c.id)) return false
        seen.add(c.id)
        return true
      })
    },
    enabled: user != null && !scope.isLoading && myAssignments.isSuccess,
  })

  const loading = !user || scope.isLoading || courses.isLoading
  const rows = courses.data ?? []
  const institutionName = (id: string) => institutionNames.get(id)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kelola Pelatihan"
        description={
          loading
            ? "Pelatihan yang Anda kelola."
            : scope.scopeId === ALL_INSTITUTIONS
              ? `${rows.length} pelatihan di seluruh platform.`
              : ownedIds.length === 0
                ? "Anda belum memiliki institusi."
                : `${rows.length} pelatihan di ${scope.institution?.name ?? "institusi Anda"}.`
        }
        actions={
          <Button nativeButton={false} render={<Link to="/instructor/courses/new" params={{}} />}>
            Buat Pelatihan
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : courses.isError ? (
        <ErrorState error={courses.error} onRetry={() => void courses.refetch()} />
      ) : scope.isError ? (
        <ErrorState error={scope.error} onRetry={scope.refetch} />
      ) : ownedIds.length === 0 && assignedCourseIds.length === 0 ? (
        <EmptyState
          title="Belum ada institusi"
          description="Daftarkan institusi terlebih dahulu untuk mengelola pelatihan."
        />
      ) : rows.length === 0 ? (
        <EmptyState title="Belum ada pelatihan" description="Buat pelatihan pertama Anda untuk memulai." />
      ) : (
        <ItemGroup>
          {rows.map((course, index) => (
            <Fragment key={course.id}>
              {index > 0 ? <ItemSeparator /> : null}
              <Item
                render={
                  <Link
                    to="/instructor/courses/$courseId/editor"
                    params={{ courseId: course.id }}
                    aria-label={course.title}
                  />
                }
              >
                <ItemMedia variant="image" className="h-14 w-24 rounded-md">
                  <CourseThumbnail thumbnail={course.thumbnail} />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>
                    {course.title}
                    <CourseStatusBadge status={course.status} />
                  </ItemTitle>
                  <ItemDescription className="line-clamp-1 text-xs">
                    {course.institutionId !== scope.scopeId ? (
                      <>{institutionName(course.institutionId) ?? "Institusi lain"} · </>
                    ) : null}
                    {course.registrantCount} pendaftar · {course.participantCount} peserta
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Badge variant="outline" className="shrink-0">
                    Kelola
                  </Badge>
                </ItemActions>
              </Item>
            </Fragment>
          ))}
        </ItemGroup>
      )}
    </div>
  )
}
