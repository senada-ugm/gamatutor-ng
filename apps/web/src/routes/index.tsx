import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { NativeAnchor } from "@workspace/ui/composed/native-anchor"
import type { ContractCourse } from "@workspace/contracts/domain"

import { EmptyState } from "@/components/_shared/empty-state"
import { SiteHeader } from "@/components/_shared/site-header"
import { CourseCard } from "@/components/courses/course-card"
import { getServerCourses } from "@/lib/server-api"
import { APP_ORIGIN } from "@/lib/env"

export const Route = createFileRoute("/")({
  loader: async () => {
    const courses = (await getServerCourses({
      data: { status: "published", pageSize: 6 },
    })) as ContractCourse[]
    return { courses }
  },
  head: () => ({
    meta: [
      { title: "Portal Pelatihan" },
      {
        name: "description",
        content: "Jelajahi pelatihan dari institusi mitra resmi, daftar online, dan dapatkan sertifikat kelulusan.",
      },
    ],
  }),
  component: LandingPage,
})

function LandingPage() {
  const { courses } = Route.useLoaderData()

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 py-20 text-center md:px-6">
          <h1 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Pelatihan kerja dari institusi mitra resmi
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Daftar online, ikuti pelatihan, dan dapatkan sertifikat yang diakui.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button size="lg" nativeButton={false} render={<Link to="/courses" />}>
              Jelajahi Katalog
            </Button>
            <NativeAnchor href={`${APP_ORIGIN}/register`} variant="outline" size="lg" className="px-6">
              Buat Akun
            </NativeAnchor>
          </div>
        </section>

        <section className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Pelatihan Terbuka</h2>
                <p className="mt-1 text-sm text-muted-foreground">Pilihan pelatihan yang tersedia untuk didaftarkan.</p>
              </div>
              {courses.length > 0 ? (
                <Button variant="ghost" nativeButton={false} render={<Link to="/courses" />}>
                  Lihat semua
                </Button>
              ) : null}
            </div>
            {courses.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {courses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Belum ada pelatihan"
                description="Pelatihan baru akan muncul di sini — segera hadir."
              />
            )}
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground md:px-6">
          <p>Portal Pelatihan — platform pelatihan kerja resmi.</p>
        </div>
      </footer>
    </div>
  )
}
