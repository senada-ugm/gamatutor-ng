import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowRight, Award, Eye, ShieldCheck, Sparkles, Volume2 } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@workspace/ui/components/card"
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
      { title: "GamaTutor — Platform Pelatihan Klinis Oftalmologi UGM" },
      {
        name: "description",
        content:
          "Platform e-learning klinis interaktif deteksi dini retinopati diabetik dan kompetensi oftalmologi praktis dari FKKMK UGM.",
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
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/5 via-background to-background py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-4 text-center md:px-6">
            <div className="flex justify-center">
              <Badge
                variant="outline"
                className="gap-1.5 border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
              >
                <Sparkles className="size-3.5" />
                <span>INISIATIF DRIVE • FKKMK UNIVERSITAS GADJAH MADA</span>
              </Badge>
            </div>

            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Platform Pelatihan Klinis Oftalmologi & Deteksi Dini Retinopati
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Tingkatkan kompetensi diagnostik klinis tenaga kesehatan melalui simulasi fundus fotografi interaktif,
              penelusuran patofisiologi berurutan, panduan voiceover terpandu, dan sertifikasi dokter terverifikasi.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" nativeButton={false} render={<Link to="/courses" />}>
                <span>Jelajahi Katalog Pelatihan</span>
                <ArrowRight className="ml-2 size-4" />
              </Button>
              <NativeAnchor href={`${APP_ORIGIN}/register`} variant="outline" size="lg" className="px-6">
                Daftar Akun Klinisi
              </NativeAnchor>
            </div>
          </div>
        </section>

        {/* Feature Cards Grid (GamaTutor Superpowers via shadcn Card) */}
        <section className="border-b bg-muted/20 py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <Badge variant="secondary" className="mb-2">
                Keunggulan Pembelajaran
              </Badge>
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Dirancang untuk Kebutuhan Praktik Klinis Riil
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Kombinasi materi spesialis mata dengan teknologi interaktif modern untuk efektivitas transfer ilmu
                klinis.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <Card className="transition-all hover:shadow-md">
                <CardHeader>
                  <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Eye className="size-5" />
                  </div>
                  <CardTitle>Simulasi Fundus & Hotspot</CardTitle>
                  <CardDescription>
                    Penelusuran lesi mikrovaskular dengan 8-tahap hotspot patofisiologi, grading klinis fundus 1.5x
                    zoom, dan matching game faktor risiko diabetes.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="transition-all hover:shadow-md">
                <CardHeader>
                  <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Volume2 className="size-5" />
                  </div>
                  <CardTitle>Voiceover & Transkrip Terpadu</CardTitle>
                  <CardDescription>
                    38 file audio suara narasi bahasa Indonesia yang tersinkronisasi otomatis dengan animasi per-slide,
                    dilengkapi transkrip teks berstruktur rapi.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="transition-all hover:shadow-md">
                <CardHeader>
                  <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Award className="size-5" />
                  </div>
                  <CardTitle>Sertifikat Terakreditasi</CardTitle>
                  <CardDescription>
                    Penerbitan sertifikat digital resmi setelah evaluasi klinis selesai dengan nomor seri unik yang
                    dapat diverifikasi instansi kesehatan secara instan.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* Course Catalog Section */}
        <section className="py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Badge variant="outline" className="mb-2">
                  Katalog Kursus
                </Badge>
                <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Pelatihan Klinis Terbuka
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Program pelatihan medis terakreditasi yang siap untuk didaftarkan oleh dokter dan tenaga medis.
                </p>
              </div>
              {courses.length > 0 ? (
                <Button variant="ghost" nativeButton={false} render={<Link to="/courses" />}>
                  <span>Lihat semua</span>
                  <ArrowRight className="ml-1 size-3.5" />
                </Button>
              ) : null}
            </div>

            {courses.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Belum ada pelatihan aktif"
                description="Modul pelatihan baru sedang dipersiapkan oleh tim instruktur UGM — segera hadir."
              />
            )}
          </div>
        </section>

        {/* Certificate Verification Banner */}
        <section className="border-t bg-muted/15 py-14">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <Card className="border-dashed bg-card/60 backdrop-blur-xs">
              <CardContent className="flex flex-col items-center justify-between gap-6 p-6 md:flex-row md:p-8">
                <div className="flex items-center gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <ShieldCheck className="size-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Verifikasi Keaslian Sertifikat Lulusan</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Rumah sakit dan fasilitas kesehatan dapat memverifikasi keabsahan kredensial kompetensi peserta
                      menggunakan nomor seri sertifikat.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link to="/certificates/verify" />}
                  className="shrink-0"
                >
                  Verifikasi Sertifikat
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 text-xs text-muted-foreground md:flex-row md:px-6">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">GamaTutor</span>
            <span>•</span>
            <span>Diabetes Retinopathy Initiative &amp; Virtual Education (DRIVE)</span>
          </div>
          <p>Departemen Ilmu Kesehatan Mata, FKKMK Universitas Gadjah Mada, Yogyakarta.</p>
        </div>
      </footer>
    </div>
  )
}
