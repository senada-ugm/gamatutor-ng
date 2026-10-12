import { useQuery } from "@tanstack/react-query"

import { apiGet } from "@/lib/api"
import type { SessionUser } from "@/lib/auth"

/**
 * Whether this user has any reason to see instructor-facing nav/pages —
 * owns an institution or is an active course-instructor somewhere. Same
 * two queries (and query keys) dashboard.tsx/instructor/index.tsx already
 * run, so visiting either page warms this for free instead of double-
 * fetching.
 */
export function useCanManageCourses(user: SessionUser | null): boolean {
  const ownerships = useQuery({
    queryKey: ["owned-institutions", user?.id],
    queryFn: () => apiGet<Array<{ institutionId: string }>>(`/institution-ownerships?userId=${user?.id}&pageSize=100`),
    enabled: user != null,
  })
  const assignments = useQuery({
    queryKey: ["course-instructors-mine", user?.id],
    queryFn: () => apiGet<Array<{ courseId: string }>>("/course-instructors/mine?pageSize=100"),
    enabled: user != null,
  })
  return (ownerships.data?.length ?? 0) > 0 || (assignments.data?.length ?? 0) > 0
}
