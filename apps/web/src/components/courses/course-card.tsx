import { Link } from "@tanstack/react-router"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent } from "@workspace/ui/components/card"
import type { ContractCourse } from "@workspace/contracts/domain"

import { CourseThumbnail } from "./course-thumbnail"
import { InstitutionLogo } from "./institution-logo"
import { formatRupiah } from "@/lib/format"
import { LEVEL_LABELS } from "@/lib/labels"

export function CourseCard({ course }: { course: ContractCourse }) {
  return (
    <Link to="/courses/$courseId" params={{ courseId: course.id }} className="block">
      <Card className="h-full overflow-hidden pt-0 transition-shadow hover:shadow-md">
        <CourseThumbnail thumbnail={course.thumbnail} className="aspect-video w-full" />
        <CardContent className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <InstitutionLogo logo={course.institution.logo} className="size-4 shrink-0 rounded-sm" />
            <span className="line-clamp-1">{course.institution.name}</span>
          </div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 leading-snug font-medium">{course.title}</h3>
            {course.price ? (
              <Badge variant="secondary" className="shrink-0">
                {formatRupiah(course.price)}
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0">
                Gratis
              </Badge>
            )}
          </div>
          {course.shortDescription ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">{course.shortDescription}</p>
          ) : null}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{LEVEL_LABELS[course.level] ?? course.level}</span>
            {course.registrantCount > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{course.registrantCount} pendaftar</span>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
