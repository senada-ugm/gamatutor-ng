import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowRight, ShieldCheck } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { NativeAnchor } from "@workspace/ui/composed/native-anchor"
import type { ContractCourse } from "@workspace/contracts/domain"

import { SiteHeader } from "@/components/_shared/site-header"
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

  // Prioritize the canonical DRIVE retinopathy course
  const driveCourse = courses.find(
    (c) =>
      c.title.toLowerCase().includes("retinopati") ||
      c.title.toLowerCase().includes("drive") ||
      c.id.toLowerCase().includes("drive")
  )
  const otherCourses = courses.filter((c) => c.id !== driveCourse?.id)

  return (
    <div className="flex min-h-svh flex-col bg-[#f4f7f9] dark:bg-background">
      <SiteHeader />

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
          {/* Hero Section (matches gamatutor-ng .hero style) */}
          <section className="rounded-2xl bg-gradient-to-br from-[#132d47] via-[#173a5e] to-[#2d77c2] p-8 text-white shadow-md sm:p-12 md:p-14">
            <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
              Pelatihan Skrining Retinopati Diabetika
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">
              Kursus daring untuk dokter layanan primer: diabetes mellitus, retinopati diabetika, skrining dan
              tatalaksana, lalu simulasi grading foto fundus. Bernarasi, interaktif, dan bersertifikat.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="bg-white font-bold text-[#173a5e] shadow-md hover:bg-slate-100"
                nativeButton={false}
                render={<Link to="/courses" />}
              >
                <span>Jelajahi Pelatihan</span>
                <ArrowRight className="ml-2 size-4" />
              </Button>
              <NativeAnchor
                href={`${APP_ORIGIN}/register`}
                variant="outline"
                size="lg"
                className="border-2 border-white/80 bg-transparent px-6 font-semibold text-white hover:bg-white/15 hover:text-white"
              >
                Daftar sebagai peserta
              </NativeAnchor>
            </div>
          </section>

          {/* Features Grid (matches gamatutor-ng .features grid) */}
          <section className="mt-6 grid gap-4 sm:grid-cols-3">
            <Card className="border bg-card p-6 shadow-xs transition-shadow hover:shadow-md">
              <h2 className="text-base font-bold text-[#173a5e] dark:text-sky-300">Belajar sesuai waktu Anda</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Kemajuan tersimpan otomatis. Lanjutkan kapan saja dari perangkat mana pun.
              </p>
            </Card>
            <Card className="border bg-card p-6 shadow-xs transition-shadow hover:shadow-md">
              <h2 className="text-base font-bold text-[#173a5e] dark:text-sky-300">Simulasi grading</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Nilai foto fundus pasien diabetes, lalu lihat setiap lesi yang seharusnya terlihat.
              </p>
            </Card>
            <Card className="border bg-card p-6 shadow-xs transition-shadow hover:shadow-md">
              <h2 className="text-base font-bold text-[#173a5e] dark:text-sky-300">Sertifikat atas nama Anda</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Diterbitkan otomatis setelah lulus evaluasi, sesuai nama di akun, dan bisa diverifikasi.
              </p>
            </Card>
          </section>

          {/* Catalogue Section Grouped by Topic (matches gamatutor-ng .topic catalogue) */}
          <section className="mt-10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
              <div className="flex items-center gap-2.5">
                <span className="h-5 w-1.5 rounded-full bg-[#5bb4b2]" />
                <h2 className="text-lg font-bold tracking-tight text-[#173a5e] dark:text-foreground">
                  Topik: Retina &amp; Oftalmologi
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">Pelatihan kerja dari institusi mitra resmi</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Canonical DRIVE Retinopathy Course */}
              <Link
                to={driveCourse ? "/courses/$courseId" : "/courses"}
                params={driveCourse ? { courseId: driveCourse.id } : {}}
                className="block no-underline"
              >
                <Card className="group h-full cursor-pointer border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-blue-500/50 hover:shadow-md">
                  <div className="flex h-full flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-bold text-[#173a5e] transition-colors group-hover:text-primary dark:text-sky-200">
                          DRIVE — Skrining Retinopati Diabetika
                        </h3>
                        <Badge
                          variant="outline"
                          className="shrink-0 border-teal-500/40 text-teal-700 dark:text-teal-300"
                        >
                          Baru
                        </Badge>
                      </div>
                      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                        Untuk dokter layanan primer. Mencakup diabetes mellitus, retinopati diabetika, skrining dan
                        tatalaksana, simulasi grading fundus, serta evaluasi pre/post-test.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        7 modul · 32 halaman
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        Simulasi grading
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        5 soal evaluasi
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        Sertifikat
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>

              {/* Other Published Courses */}
              {otherCourses.map((c) => (
                <Link key={c.id} to="/courses/$courseId" params={{ courseId: c.id }} className="block no-underline">
                  <Card className="group h-full cursor-pointer border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-blue-500/50 hover:shadow-md">
                    <div className="flex h-full flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-base font-bold text-[#173a5e] transition-colors group-hover:text-primary dark:text-sky-200">
                            {c.title}
                          </h3>
                          <Badge variant="outline" className="shrink-0">
                            {c.level || "Umum"}
                          </Badge>
                        </div>
                        {c.shortDescription && (
                          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                            {c.shortDescription}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {c.modules?.length ?? 1} modul
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          Sertifikat
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          Bahasa Indonesia
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </section>

          {/* Section: Alat Penyusun (matches gamatutor-ng .companion) */}
          <section className="mt-10 space-y-3">
            <h2 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Alat Penyusun &amp; Standar Terbuka
            </h2>

            <Card className="border bg-card p-5 text-sm text-muted-foreground">
              <p className="mb-2 leading-relaxed">
                <strong className="font-semibold text-foreground">SlideForge</strong> mengubah presentasi PowerPoint
                menjadi kursus HTML5 yang sesuai standar — SCORM 1.2/2004, xAPI, cmi5 — lengkap dengan kuis bernilai
                yang terlapor ke gradebook LMS mana pun.
              </p>
              <p className="leading-relaxed">
                <strong className="font-semibold text-foreground">GamaTutor</strong> menayangkan hasilnya secara native
                dengan interaktivitas klinis tingkat tinggi tanpa penguncian vendor. &rarr;{" "}
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
          <section className="mt-8">
            <Card className="border border-dashed bg-card/60 p-5">
              <CardContent className="flex flex-col items-start justify-between gap-4 p-0 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ShieldCheck className="size-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Verifikasi Sertifikat Lulusan</h4>
                    <p className="text-xs text-muted-foreground">
                      Periksa keabsahan sertifikat kelulusan dokter dan peserta pelatihan menggunakan kode serial unik.
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" nativeButton={false} render={<Link to="/certificates/verify" />}>
                  Verifikasi Sekarang
                </Button>
              </CardContent>
            </Card>
          </section>

          {/* Footer (matches gamatutor-ng footer) */}
          <footer className="mt-12 border-t pt-6 text-xs leading-relaxed text-muted-foreground">
            <p className="mb-2">
              Setiap kursus di sini juga tersedia sebagai paket SCORM 1.2 yang dapat diunggah ke LMS mana pun — tidak
              ada penguncian ke platform ini.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>Departemen Ilmu Kesehatan Mata, FKKMK Universitas Gadjah Mada, Yogyakarta.</p>
              <p>
                Kode sumber:{" "}
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
