import { Fragment, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { EmptyState } from "@/components/composed/_shared/empty-state"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { Pager } from "@/components/composed/_shared/pager"
import { apiGetPaged, apiSend } from "@/lib/api"
import { formatCourseDate } from "@/lib/lms-date"
import type { ContractNotification } from "@workspace/contracts/domain"

const PAGE_SIZE = 20

export function NotificationsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)

  const notifications = useQuery({
    queryKey: ["notifications", page],
    queryFn: () => apiGetPaged<ContractNotification>(`/notifications?page=${page}&pageSize=${PAGE_SIZE}`),
  })

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] })
  }

  const markRead = useMutation({
    mutationFn: (id: string) => apiSend<ContractNotification>("POST", `/notifications/${id}/read`),
    onSuccess: invalidate,
    onError: () => toast.error("Gagal menandai notifikasi"),
  })

  const markAllRead = useMutation({
    mutationFn: () => apiSend<ContractNotification>("POST", "/notifications/read-all"),
    onSuccess: () => {
      toast.success("Semua notifikasi ditandai terbaca")
      invalidate()
    },
    onError: () => toast.error("Gagal menandai notifikasi"),
  })

  const rows = notifications.data?.data ?? []
  const hasUnread = rows.some((n) => !n.readAt)

  function openLink(link: string | null | undefined) {
    if (!link) return
    // Notification links are app-relative SPA routes.
    navigate({ to: link }).catch(() => {
      window.location.href = link
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifikasi"
        description="Aktivitas pelatihan Anda."
        actions={
          hasUnread ? (
            <Button size="sm" variant="outline" disabled={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
              Tandai Semua Terbaca
            </Button>
          ) : null
        }
      />

      {notifications.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : notifications.isError ? (
        <ErrorState error={notifications.error} onRetry={() => void notifications.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="Belum ada notifikasi" description="Aktivitas pelatihan Anda akan muncul di sini." />
      ) : (
        <ItemGroup>
          {rows.map((notification, index) => (
            <Fragment key={notification.id}>
              {index > 0 ? <ItemSeparator /> : null}
              <Item className={notification.readAt ? "opacity-70" : ""}>
                <ItemContent>
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-start"
                    onClick={() => {
                      if (!notification.readAt) markRead.mutate(notification.id)
                      openLink(notification.link)
                    }}
                  >
                    <ItemTitle>
                      {!notification.readAt ? <Badge>Baru</Badge> : null}
                      {notification.title}
                    </ItemTitle>
                    {notification.body ? <ItemDescription>{notification.body}</ItemDescription> : null}
                    <ItemDescription className="line-clamp-1 text-xs">
                      {formatCourseDate(notification.createdAt, {
                        full: false,
                      })}
                    </ItemDescription>
                  </button>
                </ItemContent>
                {!notification.readAt ? (
                  <ItemActions>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={markRead.isPending}
                      onClick={() => markRead.mutate(notification.id)}
                    >
                      Tandai Terbaca
                    </Button>
                  </ItemActions>
                ) : null}
              </Item>
            </Fragment>
          ))}
        </ItemGroup>
      )}

      <Pager
        page={page}
        totalPages={notifications.data?.pagination.totalPages ?? 1}
        disabled={notifications.isFetching}
        onPageChange={setPage}
      />
    </div>
  )
}
