import { createFileRoute, notFound } from "@tanstack/react-router"
import type { ContractCourse } from "@workspace/contracts/domain"

import { SiteHeader } from "@/components/_shared/site-header"
import { CourseDetail } from "@/components/courses/course-detail"
import { getServerCourse, getServerInstitution } from "@/lib/server-api"

export const Route = createFileRoute("/courses/$courseId")({
  loader: async ({ params }) => {
    const course = (await getServerCourse({
      data: params.courseId,
    })) as ContractCourse | null
    if (!course) throw notFound()

    const institution = course.institutionId
      ? ((await getServerInstitution({ data: course.institutionId })) as {
          name?: string
        } | null)
      : null

    return { course, institutionName: institution?.name ?? "" }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.course?.title ?? "Detail Pelatihan" },
      {
        name: "description",
        content: loaderData?.course?.shortDescription ?? "Informasi, syarat, dan pendaftaran pelatihan.",
      },
    ],
  }),
  component: CourseDetailPage,
})

function CourseDetailPage() {
  const { course, institutionName } = Route.useLoaderData()

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
          <CourseDetail course={course} institutionName={institutionName} />
        </div>
      </main>
    </div>
  )
}
