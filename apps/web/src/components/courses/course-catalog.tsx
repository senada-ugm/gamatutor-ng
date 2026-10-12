import { Link } from "@tanstack/react-router"
import { NativeButton } from "@workspace/ui/composed/native-button"
import { NativeInput } from "@workspace/ui/composed/native-input"
import type { ContractCourse } from "@workspace/contracts/domain"

import { CourseCard } from "./course-card"
import { EmptyState } from "@/components/_shared/empty-state"
import { PageHeader } from "@/components/_shared/page-header"

/**
 * Server-searched catalog: the ?q= search param drives the loader's API
 * call, so this works without client JS (plain GET form).
 */
export function CourseCatalog({ courses, query }: { courses: ContractCourse[]; query: string }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Katalog Pelatihan"
        description={
          query ? `Hasil pencarian "${query}" — ${courses.length} pelatihan` : `${courses.length} pelatihan tersedia`
        }
      />
      <form method="get" className="flex max-w-sm gap-2">
        <NativeInput
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Cari pelatihan…"
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  )
}
