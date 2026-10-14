import { useQuery } from "@tanstack/react-query"

import { CourseInstructorsManager } from "@/components/composed/courses/course-instructors-manager"
import { useEditorCourse } from "@/routes/instructor/editor"
import { useSession } from "@/lib/session"
import { apiGet } from "@/lib/api"

export function EditorInstructorsTab() {
  const course = useEditorCourse()
  const session = useSession()
  const user = session.data ?? null

  // Mirrors the API's assertCanManageCourseInstructors gate: admin or
  // the institution's owner. Shares the react-query cache with the
  // instructor course list, so this is usually a cache hit.
  const ownerships = useQuery({
    queryKey: ["owned-institutions", user?.id],
    queryFn: () => apiGet<Array<{ institutionId: string }>>(`/institution-ownerships?userId=${user?.id}&pageSize=100`),
    enabled: user != null && user.role !== "admin",
  })

  const canInvite =
    user?.role === "admin" || (ownerships.data ?? []).some((o) => o.institutionId === course.institutionId)

  return <CourseInstructorsManager courseId={course.id} institutionId={course.institutionId} canInvite={canInvite} />
}
