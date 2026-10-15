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
import { useMyInstitution } from "@/lib/institution-ownership"
import { useSession } from "@/lib/session"
import { apiGet } from "@/lib/api"
import type { ContractCourse } from "@workspace/contracts/domain"

export function InstructorCoursesPage() {
  const session = useSession()
  const user = session.data ?? null

  // The single tenant this account works under (PLANS Phase 5) — no
  // scope switcher; admins resolve to their first grant like everyone
  // else, falling back to the platform's one registered institution.
  const myInstitution = useMyInstitution()

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
    queryKey: ["courses", "managed", user?.role, myInstitution?.id, assignedCourseIds.join(",")],
    queryFn: async () => {
      const perInstitution = myInstitution
        ? [await apiGet<ContractCourse[]>(`/courses?institutionId=${myInstitution.id}&pageSize=100`)]
        : []
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
    enabled: user != null && myInstitution !== undefined && myAssignments.isSuccess,
  })

  const loading = !user || myInstitution === undefined || courses.isLoading
  const rows = courses.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kelola Pelatihan"
        description={
          loading
            ? "Pelatihan yang Anda kelola."
            : myInstitution
              ? `${rows.length} pelatihan di ${myInstitution.name}.`
              : "Pelatihan yang Anda ampu sebagai instruktur."
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
      ) : !myInstitution && assignedCourseIds.length === 0 ? (
        <EmptyState
          title="Belum ada akses pelatihan"
          description="Hubungi admin platform untuk mendapatkan akses institusi atau penugasan instruktur."
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
