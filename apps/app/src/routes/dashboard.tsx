import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Award, ChevronRight, GraduationCap } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { CourseThumbnail } from "@/components/composed/courses/_atoms/course-thumbnail"
import { EnrollmentStatusBadge } from "@/components/composed/_shared/enrollment-status-badge"
import { EmptyState } from "@/components/composed/_shared/empty-state"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { useAuthoringScope } from "@/lib/authoring-institution"
import { useSession } from "@/lib/session"
import { apiGet } from "@/lib/api"
import { formatCourseDate } from "@/lib/lms-date"
import type { ContractCourse, ContractEnrollment, ContractRegisteredInstitution } from "@workspace/contracts/domain"

export function DashboardPage() {
  const { data: session } = useSession()
  const authoringScope = useAuthoringScope()
  const user = session ?? null
  const isAdmin = user?.role === "admin"

  const enrollmentsQuery = useQuery({
    queryKey: ["my-enrollments", user?.id],
    queryFn: () => apiGet<ContractEnrollment[]>("/enrollments?pageSize=100"),
    enabled: user != null,
  })

  const ownerships = useQuery({
    queryKey: ["owned-institutions", user?.id],
    queryFn: () => apiGet<Array<{ institutionId: string }>>(`/institution-ownerships?userId=${user?.id}&pageSize=100`),
    enabled: user != null,
  })
  const ownedIds = (ownerships.data ?? []).map((o) => o.institutionId)

  const institutions = useQuery({
    queryKey: ["institutions", "map"],
    queryFn: () => apiGet<ContractRegisteredInstitution[]>("/institutions?pageSize=100"),
    enabled: ownedIds.length > 0,
    select: (list) => list.filter((i) => ownedIds.includes(i.id)),
  })

  const courses = useQuery({
    queryKey: ["courses", "titles"],
    queryFn: () => apiGet<ContractCourse[]>("/courses?pageSize=100"),
    enabled: user != null,
    select: (list) => new Map(list.map((c) => [c.id, c])),
  })

  const myEnrollments = enrollmentsQuery.data ?? []
  const passedCount = myEnrollments.filter((e) => e.status === "graduated" || e.certificateIssued).length
  const inProgressCount = myEnrollments.filter(
    (e) => e.status === "selected" || (e.status === "registered" && !e.certificateIssued)
  ).length

  return (
    <div className="space-y-8">
      {/* Hero Banner Klinis GamaTutor */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#132d47] via-[#173a5e] to-[#2d77c2] p-6 text-white shadow-md md:p-8">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md">
            <span>👁</span>
            <span>Platform Pembelajaran Klinis Terakreditasi</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            Selamat datang, {user?.name ?? "Dokter Peserta"}
          </h1>
          <p className="text-sm text-white/80 md:text-base">
            Pantau perkembangan pelatihan skrining retinopati diabetika, evaluasi kompetensi klinis, dan kelulusan
            sertifikasi Anda di sini.
          </p>
        </div>

        <div className="relative z-10 mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4">
          <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
            <span className="block text-2xl font-bold text-white">{myEnrollments.length}</span>
            <span className="text-xs text-white/70">Pelatihan Diikuti</span>
          </div>
          <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
            <span className="block text-2xl font-bold text-[#75c9c7]">{inProgressCount}</span>
            <span className="text-xs text-white/70">Sedang Berjalan</span>
          </div>
          <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
            <span className="block text-2xl font-bold text-emerald-300">{passedCount}</span>
            <span className="text-xs text-white/70">Lulus / Bersertifikat</span>
          </div>
          <div className="flex flex-col justify-center rounded-xl bg-white/15 p-3 backdrop-blur-sm">
            <Link to="/courses" className="inline-flex items-center gap-1 text-xs font-bold text-white hover:underline">
              Katalog Lengkap <ChevronRight className="size-3.5" />
            </Link>
            <span className="text-[11px] text-white/70">Jelajahi Pelatihan</span>
          </div>
        </div>
      </div>

      {/* Admin Quick Console (if admin) */}
      {isAdmin ? (
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-[#173a5e] text-white">
                <GraduationCap className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#173a5e] dark:text-blue-300">Konsol Administrasi Platform</h2>
                <p className="text-xs text-muted-foreground">
                  Kelola pengguna, institusi mitra, pengaturan platform, dan audit log.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" nativeButton={false} render={<Link to="/admin" />}>
                Ikhtisar Admin
              </Button>
              <Button size="sm" variant="outline" nativeButton={false} render={<Link to="/admin/users" />}>
                Kelola Peserta
              </Button>
              <Button size="sm" variant="outline" nativeButton={false} render={<Link to="/admin/institutions" />}>
                Institusi
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Kursus yang Sedang Diikuti */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-5 w-1.5 rounded-full bg-[#5bb4b2]" />
            <h2 className="text-lg font-bold text-[#173a5e] dark:text-foreground">Pelatihan Saya</h2>
          </div>
          <Button size="sm" variant="ghost" nativeButton={false} render={<Link to="/courses" />}>
            Buka Katalog &rarr;
          </Button>
        </div>

        {enrollmentsQuery.isLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : enrollmentsQuery.isError ? (
          <ErrorState error={enrollmentsQuery.error} onRetry={() => void enrollmentsQuery.refetch()} />
        ) : myEnrollments.length === 0 ? (
          <EmptyState
            title="Belum ada pelatihan terdaftar"
            description={
              <>
                Anda belum terdaftar dalam pelatihan apapun. Silakan{" "}
                <Link to="/courses" className="font-semibold text-primary underline underline-offset-4">
                  buka katalog pelatihan
                </Link>{" "}
                untuk memulai.
              </>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {myEnrollments.map((enrollment) => {
              const course = courses.data?.get(enrollment.courseId)
              const isGraduated = enrollment.status === "graduated" || enrollment.certificateIssued
              return (
                <Card
                  key={enrollment.id}
                  className="relative flex flex-col justify-between overflow-hidden pt-0 transition-shadow hover:shadow-md"
                >
                  <div>
                    <CourseThumbnail thumbnail={course?.thumbnail} className="aspect-video w-full" />
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 text-sm leading-snug font-bold">
                          <Link
                            to="/learn/$courseId"
                            params={{ courseId: enrollment.courseId }}
                            className="hover:text-primary hover:underline"
                          >
                            {course?.title ?? enrollment.courseId}
                          </Link>
                        </h3>
                        <EnrollmentStatusBadge status={enrollment.status} />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Progres Pembelajaran</span>
                          <span className="font-bold text-foreground">{enrollment.progress}%</span>
                        </div>
                        <Progress value={enrollment.progress} className="h-1.5" />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Terdaftar: {formatCourseDate(enrollment.enrolledAt, { full: false })}</span>
                        {enrollment.finalGrade != null ? (
                          <span className="font-semibold text-emerald-600">Nilai: {enrollment.finalGrade}</span>
                        ) : null}
                      </div>
                    </CardContent>
                  </div>

                  <div className="border-t p-3 pt-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 font-semibold"
                        variant={isGraduated ? "outline" : "default"}
                        nativeButton={false}
                        render={<Link to="/learn/$courseId" params={{ courseId: enrollment.courseId }} />}
                      >
                        {isGraduated ? "Buka Kembali" : "Lanjutkan Belajar"}
                      </Button>
                      {enrollment.certificateId ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="shrink-0 text-xs"
                          nativeButton={false}
                          render={
                            <Link
                              to="/certificates/$certificateId"
                              params={{ certificateId: enrollment.certificateId }}
                            />
                          }
                        >
                          <Award className="size-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* Institusi Saya (untuk owner atau admin) */}
      {!isAdmin || ownedIds.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="h-5 w-1.5 rounded-full bg-[#173a5e]" />
            <h2 className="text-lg font-bold text-[#173a5e] dark:text-foreground">Institusi Saya</h2>
          </div>

          {ownerships.isLoading || (ownedIds.length > 0 && institutions.isLoading) ? (
            <Skeleton className="h-20 w-full" />
          ) : ownedIds.length === 0 ? (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="text-sm text-muted-foreground">
                  Ingin menyelenggarakan pelatihan atas nama fasilitas kesehatan atau institusi Anda?
                </p>
                <Button size="sm" variant="outline" nativeButton={false} render={<Link to="/institution-requests" />}>
                  Ajukan Institusi Baru
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {(institutions.data ?? []).map((institution) => (
                <Card key={institution.id}>
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{institution.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {institution.email ?? institution.institutionType}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        onClick={() => authoringScope.select(institution.id)}
                        render={<Link to="/institution" />}
                      >
                        Ikhtisar
                      </Button>
                      <Button
                        size="sm"
                        nativeButton={false}
                        onClick={() => authoringScope.select(institution.id)}
                        render={<Link to="/instructor" />}
                      >
                        Kelola Pelatihan
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
