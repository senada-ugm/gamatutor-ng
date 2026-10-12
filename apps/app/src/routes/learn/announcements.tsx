import { Fragment } from "react"
import { useQuery } from "@tanstack/react-query"

import { Badge } from "@workspace/ui/components/badge"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@workspace/ui/components/item"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { EmptyState } from "@/components/composed/_shared/empty-state"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { useCourseContext } from "@/components/composed/player/course-context"
import { apiGet } from "@/lib/api"
import { formatCourseDate } from "@/lib/lms-date"
import type { ContractAnnouncement } from "@workspace/contracts/domain"

/** Player Pengumuman tab — published announcements, pinned first. */
export function PlayerAnnouncementsPage() {
  const { course } = useCourseContext()

  const announcements = useQuery({
    queryKey: ["announcements", course.id],
    queryFn: () => apiGet<ContractAnnouncement[]>(`/courses/${course.id}/announcements?pageSize=100`),
    select: (rows) => rows.filter((a) => a.isPublished),
  })

  if (announcements.isLoading) {
    return <Skeleton className="h-32 w-full" />
  }

  const rows = [...(announcements.data ?? [])].sort((a, b) => Number(b.isPinned) - Number(a.isPinned))

  if (rows.length === 0) {
    return (
      <div>
        <PageHeader title="Pengumuman" />
        <EmptyState title="Belum ada pengumuman" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Pengumuman" />
      <ItemGroup>
        {rows.map((announcement, index) => (
          <Fragment key={announcement.id}>
            {index > 0 ? <ItemSeparator /> : null}
            <Item>
              <ItemContent>
                <ItemTitle>
                  {announcement.isPinned ? <Badge variant="secondary">Disemat</Badge> : null}
                  {announcement.title}
                </ItemTitle>
                <ItemDescription className="whitespace-pre-wrap">{announcement.content}</ItemDescription>
                <ItemDescription className="line-clamp-1 text-xs">
                  {announcement.user.name} · {formatCourseDate(announcement.createdAt, { full: false })}
                </ItemDescription>
              </ItemContent>
            </Item>
          </Fragment>
        ))}
      </ItemGroup>
    </div>
  )
}
