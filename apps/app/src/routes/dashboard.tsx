import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { CourseThumbnail } from "@/components/composed/courses/_atoms/course-thumbnail"
import { EnrollmentStatusBadge } from "@/components/composed/_shared/enrollment-status-badge"
import { EmptyState } from "@/components/composed/_shared/empty-state"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { useAuthoringScope } from "@/lib/authoring-institution"
import { useSession } from "@/lib/session"
import { apiGet } from "@/lib/api"
import { formatCourseDate } from "@/lib/lms-date"
import type { ContractCourse, ContractEnrollment, ContractRegisteredInstitution } from "@workspace/contracts/domain"

/**
 * The adaptive home: every signed-in account gets the sections its
 * capabilities justify — learners see their enrollments with progress,
 * institution owners see their institutions, admins get the platform
 * overview entry. Same priority legacy's deriveDefaultSection encoded
 * (admin > owner > instructor > student), rendered as one page instead
 * of per-role redirects.
 */

export function DashboardPage() {
  const { data: session } = useSession()
  const authoringScope = useAuthoringScope()
  const user = session ?? null
  const isAdmin = user?.role === "admin"

  const enrollments = useQuery({
    queryKey: ["my-enrollments", user?.id],
    queryFn: () => apiGet<ContractEnrollment[]>("/enrollments?pageSize=100"),
    enabled: user != null,
  })

  const ownerships = useQuery({
    queryKey: ["owned-institutions", user?.id],
    queryFn: () => apiGet<Array<{ institutionId: string }>>(`/institution-ownerships?userId=${user?.id}&pageSize=100`),
    enabled: user != null,
  })
  const ownedIds = (ownerships.data ?? []).map((o) => o.institutionId)

  const institutions = useQuery({
    queryKey: ["institutions", "map"],
    queryFn: () => apiGet<ContractRegisteredInstitution[]>("/institutions?pageSize=100"),
    enabled: ownedIds.length > 0,
    select: (list) => list.filter((i) => ownedIds.includes(i.id)),
  })

  // Course titles for the enrollment cards — one list call, map by id.
  const courses = useQuery({
    queryKey: ["courses", "titles"],
    queryFn: () => apiGet<ContractCourse[]>("/courses?pageSize=100"),
    enabled: user != null,
    select: (list) => new Map(list.map((c) => [c.id, c])),
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description={<>Welcome back, {user?.name}.</>} />

      {isAdmin ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-medium">Platform Administration</h2>
              <p className="text-sm text-muted-foreground">Analytics, users, institutions, settings, and audit logs.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" nativeButton={false} render={<Link to="/admin" />}>
                Overview
              </Button>
              <Button size="sm" variant="outline" nativeButton={false} render={<Link to="/admin/users" />}>
                Users
              </Button>
              <Button size="sm" variant="outline" nativeButton={false} render={<Link to="/admin/institutions" />}>
                Institutions
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">My Enrolled Courses</h2>
          <Button size="sm" variant="ghost" nativeButton={false} render={<Link to="/courses" />}>
            Browse Catalog
          </Button>
        </div>
        {enrollments.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : enrollments.isError ? (
          <ErrorState error={enrollments.error} onRetry={() => void enrollments.refetch()} />
        ) : (enrollments.data ?? []).length === 0 ? (
          <EmptyState
            title="No courses enrolled"
            description={
              <>
                You are not enrolled in any training program yet.{" "}
                <Link to="/courses" className="text-primary hover:underline">
                  Browse available courses
                </Link>
                .
              </>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(enrollments.data ?? []).map((enrollment) => {
              const course = courses.data?.get(enrollment.courseId)
              return (
                <Card key={enrollment.id} className="relative overflow-hidden pt-0 transition-shadow hover:shadow-md">
                  <CourseThumbnail thumbnail={course?.thumbnail} className="aspect-video w-full" />
                  <CardContent className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="min-w-0 truncate font-medium">
                        <Link
                          to="/learn/$courseId"
                          params={{ courseId: enrollment.courseId }}
                          className="after:absolute after:inset-0"
                        >
                          {course?.title ?? enrollment.courseId}
                        </Link>
                      </h3>
                      <EnrollmentStatusBadge status={enrollment.status} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          {formatCourseDate(enrollment.enrolledAt, {
                            full: false,
                          })}
                        </span>
                        <span className="font-medium text-foreground">{enrollment.progress}%</span>
                      </div>
                      <Progress value={enrollment.progress} className="h-1.5" />
                    </div>
                    {enrollment.certificateId ? (
                      <div className="flex justify-end pt-0.5">
                        <Link
                          to="/certificates/$certificateId"
                          params={{ certificateId: enrollment.certificateId }}
                          className="relative z-10 text-xs font-medium text-primary hover:underline"
                        >
                          View Certificate &rarr;
                        </Link>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {!isAdmin || ownedIds.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">My Institutions</h2>
          {ownerships.isLoading || (ownedIds.length > 0 && institutions.isLoading) ? (
            <Skeleton className="h-20 w-full" />
          ) : ownedIds.length === 0 ? (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">You do not own or manage any institution yet.</p>
                <Button size="sm" variant="outline" nativeButton={false} render={<Link to="/institution-requests" />}>
                  Request Institution
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {(institutions.data ?? []).map((institution) => (
                <Card key={institution.id}>
                  <CardContent className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-medium">{institution.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {institution.email ?? institution.institutionType}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        onClick={() => authoringScope.select(institution.id)}
                        render={<Link to="/institution" />}
                      >
                        Overview
                      </Button>
                      <Button
                        size="sm"
                        nativeButton={false}
                        onClick={() => authoringScope.select(institution.id)}
                        render={<Link to="/instructor" />}
                      >
                        Manage Courses
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
