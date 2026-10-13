import { createFileRoute, Link } from "@tanstack/react-router"
import { ShieldCheck } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import type { ContractCourse } from "@workspace/contracts/domain"

import { SiteHeader } from "@/components/_shared/site-header"
import { getServerCourses } from "@/lib/server-api"

export const Route = createFileRoute("/")({
  loader: async () => {
    const courses = (await getServerCourses({
      data: { status: "published", pageSize: 6 },
    })) as ContractCourse[]
    return { courses }
  },
  head: () => ({
    meta: [
      { title: "GamaTutor — Platform Penyampaian E-Learning SENADA UGM" },
      {
        name: "description",
        content:
          "Platform penyampaian e-learning mandiri dari SENADA FKKMK UGM. Menyelenggarakan pelatihan interaktif retinopati diabetik dan oftalmologi praktis.",
      },
    ],
  }),
  component: LandingPage,
})

function LandingPage() {
  const { courses } = Route.useLoaderData()

  // Find the canonical DRIVE retinopathy course if present, or fallback
  const driveCourse = courses.find(
    (c) =>
      c.title.toLowerCase().includes("retinopati") ||
      c.title.toLowerCase().includes("drive") ||
      c.id.toLowerCase().includes("drive")
  )
  const otherCourses = courses.filter((c) => c.id !== driveCourse?.id)

  return (
    <div className="flex min-h-svh flex-col bg-muted/20">
      <SiteHeader />

      <main className="flex-1">
        <div className="mx-auto max-w-[760px] px-4 py-12 md:py-16">
          {/* Header Mark & Title (from gamatutor-ng deploy/landing/index.html) */}
          <header className="mb-8 flex items-center gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-blue-600 text-xl text-white shadow-xs select-none">
              👁
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">GamaTutor</h1>
              <p className="text-sm text-muted-foreground">Platform penyampaian e-learning — SENADA UGM</p>
            </div>
          </header>

          {/* Status Platform Banner */}
          <div className="mb-8 rounded-xl border border-teal-500/30 bg-teal-500/10 p-4 text-sm text-foreground/90 dark:bg-teal-950/20">
            <p className="leading-relaxed">
              <strong className="font-semibold text-teal-800 dark:text-teal-300">Platform Produksi Aktif.</strong>{" "}
              Platform pembelajaran klinis interaktif resmi hasil kolaborasi tim DRIVE dan Departemen Ilmu Kesehatan
              Mata FKKMK UGM. Dilengkapi engine simulasi fundus fotografi, 8-tahap hotspot patofisiologi, voiceover
              tersinkronisasi, dan sertifikasi digital terverifikasi.
            </p>
          </div>

          {/* Section: Kursus Tersedia */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Kursus Tersedia</h2>

            {/* Canonical DRIVE Retinopathy Course Card */}
            <Link
              to={driveCourse ? "/courses/$courseId" : "/courses"}
              params={driveCourse ? { courseId: driveCourse.id } : {}}
              className="block no-underline"
            >
              <Card className="group cursor-pointer border p-5 transition-all hover:-translate-y-0.5 hover:border-blue-500/50 hover:shadow-md">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-bold text-foreground transition-colors group-hover:text-primary">
                      DRIVE — Skrining Retinopati Diabetika
                    </h3>
                    <Badge variant="outline" className="shrink-0 border-teal-500/40 text-teal-700 dark:text-teal-300">
                      Modul Klinis
                    </Badge>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Untuk dokter layanan primer. Mencakup diabetes mellitus, retinopati diabetika, skrining dan
                    tatalaksana, simulasi grading fundus, serta evaluasi pre/post-test.
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-2">
                    <Badge variant="secondary" className="text-xs">
                      7 modul · 32 halaman
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      Simulasi grading
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      5 soal evaluasi
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      Sertifikat
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      Bahasa Indonesia
                    </Badge>
                  </div>
                </div>
              </Card>
            </Link>

            {/* Other Published Courses in Database */}
            {otherCourses.map((c) => (
              <Link key={c.id} to="/courses/$courseId" params={{ courseId: c.id }} className="block no-underline">
                <Card className="group cursor-pointer border p-5 transition-all hover:-translate-y-0.5 hover:border-blue-500/50 hover:shadow-md">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {c.institution?.name && (
                          <p className="mb-1 text-xs text-muted-foreground">{c.institution.name}</p>
                        )}
                        <h3 className="text-lg font-bold text-foreground transition-colors group-hover:text-primary">
                          {c.title}
                        </h3>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {c.level || "Umum"}
                      </Badge>
                    </div>
                    {c.shortDescription && (
                      <p className="text-sm leading-relaxed text-muted-foreground">{c.shortDescription}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      <Badge variant="secondary" className="text-xs">
                        {c.modules?.length ?? 1} modul
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        Sertifikat
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        Bahasa Indonesia
                      </Badge>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </section>

          {/* Section: Alat Penyusun & Standar Terbuka (from gamatutor-ng companion block) */}
          <section className="mt-8 space-y-3">
            <h2 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Alat Penyusun &amp; Standar Terbuka
            </h2>

            <Card className="border p-5 text-sm text-muted-foreground">
              <p className="mb-2.5 leading-relaxed">
                <strong className="font-semibold text-foreground">SlideForge</strong> mengubah presentasi PowerPoint
                menjadi kursus HTML5 yang sesuai standar internasional — SCORM 1.2/2004, xAPI, cmi5 — lengkap dengan
                kuis bernilai yang terlapor ke gradebook LMS mana pun.
              </p>
              <p className="leading-relaxed">
                <strong className="font-semibold text-foreground">GamaTutor</strong> menayangkan hasilnya secara native
                dengan interaktivitas tingkat tinggi (hotspot sequential, visualisasi anatomi 2D, voiceover audio
                tersinkronisasi) tanpa penguncian vendor. &rarr;{" "}
                <a
                  href="https://slideforge.komunitech.id/"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  slideforge.komunitech.id
                </a>
              </p>
            </Card>
          </section>

          {/* Section: Verifikasi Sertifikat Publik */}
          <section className="mt-8 space-y-3">
            <h2 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Verifikasi Kelulusan</h2>

            <Card className="border border-dashed p-5">
              <CardContent className="flex flex-col items-start justify-between gap-4 p-0 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ShieldCheck className="size-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Verifikasi Sertifikat Resmi</h4>
                    <p className="text-xs text-muted-foreground">
                      Periksa keabsahan sertifikat kelulusan dokter dan tenaga medis menggunakan kode serial unik.
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" nativeButton={false} render={<Link to="/certificates/verify" />}>
                  Verifikasi Sekarang
                </Button>
              </CardContent>
            </Card>
          </section>

          {/* Footer */}
          <footer className="mt-12 border-t pt-6 text-xs leading-relaxed text-muted-foreground">
            <p className="mb-2">
              Setiap kursus di sini juga tersedia sebagai paket SCORM 1.2 yang dapat diunggah ke LMS mana pun — tidak
              ada penguncian ke platform ini.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>Departemen Ilmu Kesehatan Mata, FKKMK Universitas Gadjah Mada, Yogyakarta.</p>
              <p>
                Repositori:{" "}
                <a
                  href="https://github.com/senada-ugm/gamatutor-ng"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  senada-ugm/gamatutor-ng
                </a>
              </p>
            </div>
          </footer>
        </div>
      </main>
    </div>
  )
}
