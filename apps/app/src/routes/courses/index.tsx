import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { Skeleton } from "@workspace/ui/components/skeleton"

import { CourseCard } from "@/components/composed/courses/_atoms/course-card"
import { EmptyState } from "@/components/composed/_shared/empty-state"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { Pager } from "@/components/composed/_shared/pager"
import { SearchInput, useDebouncedValue } from "@/components/composed/_shared/search-input"
import { apiGetPaged } from "@/lib/api"
import type { ContractCourse } from "@workspace/contracts/domain"

/**
 * Transactional catalog — published courses with search, so a signed-in
 * learner can find and enroll. The marketing landing page is apps/web's
 * job; this is the app-side funnel.
 */

const PAGE_SIZE = 20

export function CourseCatalogPage() {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search)
  const [page, setPage] = useState(1)

  const courses = useQuery({
    queryKey: ["courses", "published", debouncedSearch, page],
    queryFn: () =>
      apiGetPaged<ContractCourse>(
        `/courses?status=published&search=${encodeURIComponent(debouncedSearch)}&page=${page}&pageSize=${PAGE_SIZE}`
      ),
  })

  const rows = courses.data?.data ?? []
  // The envelope's total, not the current page's length — the old copy
  // read "20 pelatihan terbuka pendaftaran" on every page of a 200-course
  // catalog, and "0 pelatihan" for as long as the first fetch was in
  // flight.
  const total = courses.data?.pagination.totalCount

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course Catalog"
        description={
          total === undefined ? "Available clinical training programs." : `${total} courses open for enrollment.`
        }
      />

      <SearchInput
        label="Search courses"
        placeholder="Search courses…"
        value={search}
        onChange={(next) => {
          setSearch(next)
          setPage(1)
        }}
      />

      {courses.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : courses.isError ? (
        <ErrorState error={courses.error} onRetry={() => void courses.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No courses found"
          description={
            debouncedSearch
              ? `No results found for "${debouncedSearch}". Try another search keyword.`
              : "No courses are currently open for enrollment."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}

      <Pager
        page={page}
        totalPages={courses.data?.pagination.totalPages ?? 1}
        disabled={courses.isFetching}
        onPageChange={setPage}
      />
    </div>
  )
}
