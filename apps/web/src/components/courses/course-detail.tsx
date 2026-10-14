import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import { NativeAnchor } from "@workspace/ui/composed/native-anchor"
import type { ContractCourse } from "@workspace/contracts/domain"

import { CourseThumbnail } from "./course-thumbnail"
import { PageHeader } from "@/components/_shared/page-header"
import { APP_ORIGIN } from "@/lib/env"
import { formatRupiah } from "@/lib/format"
import { LEVEL_LABELS } from "@/lib/labels"

/**
 * Pure-SSR marketing detail: everything public about the course, with a
 * single handoff CTA into the SPA's transactional detail (where the
 * enroll/purchase funnel and wishlist live).
 */
export function CourseDetail({ course, institutionName }: { course: ContractCourse; institutionName: string }) {
  return (
    <div className="space-y-6">
      <CourseThumbnail
        thumbnail={course.thumbnail}
        placeholder={false}
        className="aspect-video w-full rounded-xl sm:aspect-[21/9] sm:max-h-80"
      />
      <div className="space-y-3">
        <PageHeader
          title={course.title}
          description={course.shortDescription}
          actions={
            <Badge variant={course.price ? "secondary" : "outline"} className="text-sm">
              {course.price ? formatRupiah(course.price) : "Gratis"}
            </Badge>
          }
        />
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {institutionName ? <span>{institutionName}</span> : null}
          <span aria-hidden="true">·</span>
          <span>{LEVEL_LABELS[course.level] ?? course.level}</span>
          {course.registrantCount > 0 ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{course.registrantCount} pendaftar</span>
            </>
          ) : null}
        </div>
      </div>

      <Separator />

      {course.description ? (
        <section>
          <h2 className="mb-2 font-semibold">Deskripsi</h2>
          <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{course.description}</p>
        </section>
      ) : null}

      {course.modules.length > 0 ? (
        <section>
          <h2 className="mb-3 font-semibold">Materi Pelatihan</h2>
          <div className="space-y-4">
            {course.modules.map((module) => (
              <Card key={module.id}>
                <CardHeader>
                  <CardTitle className="text-base">{module.title}</CardTitle>
                </CardHeader>
                {module.lessons.length > 0 ? (
                  <CardContent>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {module.lessons.map((lesson) => (
                        <li key={lesson.id} className="flex items-center justify-between">
                          <span>{lesson.title}</span>
                          {lesson.isPreview ? <Badge variant="outline">Preview</Badge> : null}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                ) : null}
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3 pt-4">
        <NativeAnchor href={`${APP_ORIGIN}/courses/${course.id}`} size="lg" className="px-6">
          {course.price ? "Daftar & Bayar" : "Daftar Sekarang"}
        </NativeAnchor>
        <NativeAnchor href={`${APP_ORIGIN}/login`} variant="outline" size="lg" className="px-6">
          Masuk
        </NativeAnchor>
      </div>
      <p className="text-xs text-muted-foreground">
        Pendaftaran, pembayaran, dan materi pelatihan berjalan di aplikasi pelatihan.
      </p>
    </div>
  )
}
