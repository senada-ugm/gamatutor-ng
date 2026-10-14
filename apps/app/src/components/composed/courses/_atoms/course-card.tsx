import { Link } from "@tanstack/react-router"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import type { ContractCourse } from "@workspace/contracts/domain"

import { CourseThumbnail } from "./course-thumbnail"
import { InstitutionLogo } from "@/components/composed/_shared/institution-logo"
import { formatRupiah } from "@/lib/format"
import { LEVEL_LABELS } from "@/lib/labels"

export type CourseLearningState = "baru" | "berjalan" | "lulus"

const STATUS_CONFIG: Record<CourseLearningState, { label: string; badgeClass: string; cta: string }> = {
  baru: {
    label: "Belum dimulai",
    badgeClass: "bg-muted text-muted-foreground border-transparent",
    cta: "Lihat Pelatihan",
  },
  berjalan: {
    label: "Sedang berjalan",
    badgeClass: "bg-[#eaf3fb] text-[#2d77c2] dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    cta: "Lanjutkan Belajar",
  },
  lulus: {
    label: "Lulus",
    badgeClass:
      "bg-[#e5f4ea] text-[#2c7a4b] dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    cta: "Buka Kembali",
  },
}

interface CourseCardProps {
  course: ContractCourse
  status?: CourseLearningState
  showCta?: boolean
}

export function CourseCard({ course, status, showCta = true }: CourseCardProps) {
  const stateConfig = status ? STATUS_CONFIG[status] : null
  const targetHref =
    status && (status === "berjalan" || status === "lulus")
      ? { to: "/learn/$courseId" as const, params: { courseId: course.id } }
      : { to: "/courses/$courseId" as const, params: { courseId: course.id } }

  return (
    <Card className="flex h-full flex-col overflow-hidden pt-0 transition-shadow hover:shadow-md">
      <Link {...targetHref} className="relative block">
        <CourseThumbnail thumbnail={course.thumbnail} className="aspect-video w-full" />
        {stateConfig ? (
          <div className="absolute top-2.5 left-2.5">
            <Badge className={`font-semibold shadow-xs ${stateConfig.badgeClass}`}>{stateConfig.label}</Badge>
          </div>
        ) : null}
      </Link>

      <CardContent className="flex flex-1 flex-col justify-between space-y-3 p-4">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <InstitutionLogo logo={course.institution.logo} className="size-4 shrink-0 rounded-sm" />
            <span className="line-clamp-1">{course.institution.name}</span>
          </div>

          <div className="flex items-start justify-between gap-2">
            <Link {...targetHref}>
              <h3 className="line-clamp-2 text-base leading-snug font-semibold tracking-tight text-foreground transition-colors hover:text-primary">
                {course.title}
              </h3>
            </Link>
            <Badge variant={course.price ? "secondary" : "outline"} className="shrink-0 font-medium">
              {course.price ? formatRupiah(course.price) : "Gratis"}
            </Badge>
          </div>

          {course.shortDescription ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{course.shortDescription}</p>
          ) : null}
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{LEVEL_LABELS[course.level] ?? course.level}</span>
            {course.participantCount > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{course.participantCount} peserta</span>
              </>
            ) : null}
          </div>

          {showCta ? (
            <Button
              size="sm"
              variant={status === "berjalan" ? "default" : "outline"}
              className={`w-full font-semibold ${
                status === "berjalan" ? "bg-[#173a5e] text-white hover:bg-[#132d47]" : ""
              }`}
              nativeButton={false}
              render={<Link {...targetHref} />}
            >
              {stateConfig?.cta ?? "Lihat Pelatihan"}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
