import { createFileRoute } from "@tanstack/react-router"
import type { ContractCourse } from "@workspace/contracts/domain"

import { SiteHeader } from "@/components/_shared/site-header"
import { CourseCatalog } from "@/components/courses/course-catalog"
import { getServerCourses } from "@/lib/server-api"

export const Route = createFileRoute("/courses/")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  loaderDeps: ({ search: { q } }) => ({ q }),
  loader: async ({ deps: { q } }) => {
    const courses = (await getServerCourses({
      data: { status: "published", pageSize: 100, search: q || undefined },
    })) as ContractCourse[]
    return { courses, query: q ?? "" }
  },
  head: () => ({
    meta: [
      { title: "Katalog Pelatihan" },
      {
        name: "description",
        content: "Semua pelatihan terbuka dari institusi mitra.",
      },
    ],
  }),
  component: CatalogPage,
})

function CatalogPage() {
  const { courses, query } = Route.useLoaderData()

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
          <CourseCatalog courses={courses} query={query} />
        </div>
      </main>
    </div>
  )
}
