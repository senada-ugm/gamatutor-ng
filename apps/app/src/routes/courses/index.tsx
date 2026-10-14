import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { Skeleton } from "@workspace/ui/components/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"

import type { CourseLearningState } from "@/components/composed/courses/_atoms/course-card"
import { CourseCard } from "@/components/composed/courses/_atoms/course-card"
import { EmptyState } from "@/components/composed/_shared/empty-state"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { Pager } from "@/components/composed/_shared/pager"
import { SearchInput, useDebouncedValue } from "@/components/composed/_shared/search-input"
import { apiGet, apiGetPaged } from "@/lib/api"
import { useSession } from "@/lib/session"
import type { ContractCourse, ContractEnrollment } from "@workspace/contracts/domain"

const PAGE_SIZE = 24

function getCourseTopic(course: ContractCourse): string {
  const text = `${course.title} ${course.shortDescription ?? ""} ${course.trainingType ?? ""}`.toLowerCase()
  if (
    text.includes("retinopati") ||
    text.includes("retina") ||
    text.includes("fundus") ||
    text.includes("dme") ||
    text.includes("amd")
  ) {
    return "Topik: Retina & Oftalmologi"
  }
  if (text.includes("glaukoma") || text.includes("saraf")) {
    return "Topik: Glaukoma & Saraf Mata"
  }
  if (text.includes("katarak") || text.includes("refraktif") || text.includes("lensa")) {
    return "Topik: Katarak & Bedah Refraktif"
  }
  return "Topik: Keterampilan Medis & Klinis Terpadu"
}

export function CourseCatalogPage() {
  const { data: session } = useSession()
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search)
  const [page, setPage] = useState(1)
  const [selectedTopic, setSelectedTopic] = useState<string>("semua")

  const coursesQuery = useQuery({
    queryKey: ["courses", "published", debouncedSearch, page],
    queryFn: () =>
      apiGetPaged<ContractCourse>(
        `/courses?status=published&search=${encodeURIComponent(debouncedSearch)}&page=${page}&pageSize=${PAGE_SIZE}`
      ),
  })

  const enrollmentsQuery = useQuery({
    queryKey: ["my-enrollments", session?.id],
    queryFn: () => apiGet<ContractEnrollment[]>("/enrollments?pageSize=100"),
    enabled: session != null,
  })

  const enrollmentMap = useMemo(() => {
    const map = new Map<string, ContractEnrollment>()
    for (const e of enrollmentsQuery.data ?? []) {
      map.set(e.courseId, e)
    }
    return map
  }, [enrollmentsQuery.data])

  function getLearningState(courseId: string): CourseLearningState {
    const enrollment = enrollmentMap.get(courseId)
    if (!enrollment) return "baru"
    if (enrollment.status === "graduated") return "lulus"
    if (enrollment.status === "selected" || enrollment.status === "registered") return "berjalan"
    return "baru"
  }

  const rows = coursesQuery.data?.data ?? []
  const total = coursesQuery.data?.pagination.totalCount

  // Kelompokkan kursus per topik
  const groupedCourses = useMemo(() => {
    const groups = new Map<string, ContractCourse[]>()
    for (const course of rows) {
      const topic = getCourseTopic(course)
      if (selectedTopic !== "semua" && topic !== selectedTopic) continue
      const list = groups.get(topic) ?? []
      list.push(course)
      groups.set(topic, list)
    }
    return groups
  }, [rows, selectedTopic])

  const allTopics = useMemo(() => {
    const topics = new Set<string>()
    for (const course of rows) {
      topics.add(getCourseTopic(course))
    }
    return Array.from(topics)
  }, [rows])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Katalog Pelatihan"
        description={
          total === undefined
            ? "Pelatihan klinis berakreditasi resmi, dikelompokkan berdasarkan topik spesialisasi."
            : `${total} pelatihan terbit terbuka untuk pendaftaran dokter dan tenaga kesehatan.`
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-md">
          <SearchInput
            label="Cari pelatihan"
            placeholder="Cari materi pelatihan, dokter pengampu, instansi…"
            value={search}
            onChange={(next) => {
              setSearch(next)
              setPage(1)
            }}
          />
        </div>

        {allTopics.length > 1 ? (
          <Tabs value={selectedTopic} onValueChange={setSelectedTopic} className="w-auto">
            <TabsList className="bg-muted">
              <TabsTrigger value="semua">Semua Topik</TabsTrigger>
              {allTopics.map((topic) => (
                <TabsTrigger key={topic} value={topic}>
                  {topic.replace("Topik: ", "")}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}
      </div>

      {coursesQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : coursesQuery.isError ? (
        <ErrorState error={coursesQuery.error} onRetry={() => void coursesQuery.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Tidak ada pelatihan ditemukan"
          description={
            debouncedSearch
              ? `Tidak ada hasil untuk "${debouncedSearch}". Coba kata kunci pencarian lain.`
              : "Belum ada pelatihan yang dibuka pendaftarannya saat ini."
          }
        />
      ) : groupedCourses.size === 0 ? (
        <EmptyState
          title="Tidak ada pelatihan untuk topik ini"
          description="Pilih topik lain atau tampilkan seluruh pelatihan."
        />
      ) : (
        <div className="space-y-10">
          {Array.from(groupedCourses.entries()).map(([topicTitle, topicCourses]) => (
            <section key={topicTitle} className="space-y-4">
              <div className="flex items-center gap-2.5 border-b pb-2">
                <div className="h-5 w-1.5 rounded-full bg-[#5bb4b2]" />
                <h2 className="text-lg font-bold text-[#173a5e] dark:text-foreground">{topicTitle}</h2>
                <span className="text-xs text-muted-foreground">({topicCourses.length} modul)</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {topicCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    status={session ? getLearningState(course.id) : undefined}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Pager
        page={page}
        totalPages={coursesQuery.data?.pagination.totalPages ?? 1}
        disabled={coursesQuery.isFetching}
        onPageChange={setPage}
      />
    </div>
  )
}
