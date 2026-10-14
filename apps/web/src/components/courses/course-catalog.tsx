import { Link } from "@tanstack/react-router"
import { NativeButton } from "@workspace/ui/composed/native-button"
import { NativeInput } from "@workspace/ui/composed/native-input"
import type { ContractCourse } from "@workspace/contracts/domain"

import { CourseCard } from "./course-card"
import { EmptyState } from "@/components/_shared/empty-state"
import { PageHeader } from "@/components/_shared/page-header"

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

/**
 * Server-searched catalog: the ?q= search param drives the loader's API
 * call, so this works without client JS (plain GET form). Grouped by clinical topics.
 */
export function CourseCatalog({ courses, query }: { courses: ContractCourse[]; query: string }) {
  const groupedCourses = new Map<string, ContractCourse[]>()
  for (const course of courses) {
    const topic = getCourseTopic(course)
    const list = groupedCourses.get(topic) ?? []
    list.push(course)
    groupedCourses.set(topic, list)
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Katalog Pelatihan"
        description={
          query
            ? `Hasil pencarian "${query}" — ${courses.length} pelatihan ditemukan`
            : `${courses.length} pelatihan klinis terbuka dari institusi mitra resmi.`
        }
      />
      <form method="get" className="flex max-w-sm gap-2">
        <NativeInput
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Cari materi pelatihan…"
          aria-label="Cari pelatihan"
        />
        <NativeButton type="submit" variant="outline">
          Cari
        </NativeButton>
      </form>
      {courses.length === 0 ? (
        <EmptyState
          title="Tidak ada pelatihan"
          description={query ? `Tidak ada pelatihan yang cocok dengan "${query}".` : "Belum ada pelatihan yang dibuka."}
          action={
            query ? (
              <Link to="/courses" className="text-sm underline underline-offset-4 hover:text-foreground">
                Hapus pencarian
              </Link>
            ) : null
          }
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
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
