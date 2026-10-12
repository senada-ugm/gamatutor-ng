import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Bell } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

import { apiGet } from "@/lib/api"

interface NotificationSummary {
  id: string
  readAt?: string | null
}

/**
 * Header bell: icon link with an unread-count pill, refreshed on a
 * slow poll — new notifications arrive server-side (grading, order
 * confirmation, announcements), not via push.
 */
export function NotificationBell() {
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiGet<NotificationSummary[]>("/notifications?pageSize=50"),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  const unread = (notifications.data ?? []).filter((n) => !n.readAt).length

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      nativeButton={false}
      render={
        <Link to="/notifications" aria-label={unread > 0 ? `Notifikasi (${unread} belum dibaca)` : "Notifikasi"} />
      }
    >
      <Bell />
      {unread > 0 ? (
        <Badge className="absolute -end-1 -top-1 h-4.5 min-w-4.5 justify-center rounded-full px-1 text-xs leading-none">
          {unread > 9 ? "9+" : unread}
        </Badge>
      ) : null}
    </Button>
  )
}
