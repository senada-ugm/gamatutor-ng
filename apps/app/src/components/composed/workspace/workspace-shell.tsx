import { Link, useMatchRoute, useNavigate } from "@tanstack/react-router"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"

import { NotificationBell } from "@/components/composed/notifications/notification-bell"
import { useCanManageCourses } from "@/lib/teaching-access"
import { useSession } from "@/lib/session"
import { signOut } from "@/lib/auth"

/**
 * Chrome for authenticated workspace pages (dashboard, instructor,
 * admin, account). The player (/learn/**) deliberately stays chrome-less
 * — it has its own shell. Session is already established by the time
 * this renders; the login redirect happens in the layout route.
 */
export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const session = useSession()
  const navigate = useNavigate()
  const matchRoute = useMatchRoute()

  const user = session.data ?? null
  const isAdmin = user?.role === "admin"
  const canManageCourses = useCanManageCourses(user)
  const showInstructorNav = isAdmin || canManageCourses

  async function handleSignOut() {
    await signOut()
    navigate({ to: "/login" })
  }

  // Active gets a filled pill; the rest sit at muted weight so the bar
  // reads as one control with one selection, not five equal buttons.
  function navClass(active: boolean) {
    return cn(active ? "bg-muted text-foreground" : "text-muted-foreground")
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b print:hidden">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 md:gap-6 md:px-6">
          <Link to="/dashboard" className="shrink-0 text-lg font-semibold tracking-tight">
            LMS
          </Link>
          {/* min-w-0 is what actually lets this scroll: without it the
              nav refuses to shrink below its content and overflows the
              header on a phone instead of scrolling. */}
          <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent_100%)] [-ms-overflow-style:none] [scrollbar-width:none] md:[mask-image:none] [&::-webkit-scrollbar]:hidden">
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              className={navClass(!!matchRoute({ to: "/dashboard" }))}
              render={<Link to="/dashboard" />}
            >
              Dasbor
            </Button>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              className={navClass(!!matchRoute({ to: "/courses", fuzzy: true }))}
              render={<Link to="/courses" />}
            >
              Katalog
            </Button>
            {showInstructorNav ? (
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                className={navClass(!!matchRoute({ to: "/instructor", fuzzy: true }))}
                render={<Link to="/instructor" />}
              >
                Instruktur
              </Button>
            ) : null}
            {isAdmin ? (
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                className={navClass(!!matchRoute({ to: "/admin", fuzzy: true }))}
                render={<Link to="/admin" />}
              >
                Admin
              </Button>
            ) : null}
          </nav>
          <div className="flex shrink-0 items-center gap-1">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger aria-label="Menu Akun" className="rounded-full">
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs font-medium">
                    {(user?.name ?? user?.email ?? "A").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-52">
                {/* An avatar with no name anywhere is the only account
                    identity the shell shows — say which account it is. */}
                <div className="px-2 py-1.5">
                  <p className="truncate text-sm font-medium">{user?.name ?? "Akun"}</p>
                  {user?.email ? <p className="truncate text-xs text-muted-foreground">{user.email}</p> : null}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link to="/profile" />}>Profil Saya</DropdownMenuItem>
                <DropdownMenuItem render={<Link to="/wishlist" />}>Wishlist</DropdownMenuItem>
                <DropdownMenuItem render={<Link to="/orders" />}>Pesanan Saya</DropdownMenuItem>
                <DropdownMenuItem render={<Link to="/assessments" />}>Asesmen</DropdownMenuItem>
                <DropdownMenuItem render={<Link to="/certificates/verify" />}>Verifikasi Sertifikat</DropdownMenuItem>
                <DropdownMenuItem render={<Link to="/institution-requests" />}>Ajukan Institusi</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void handleSignOut()}>Keluar</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6">{children}</main>
    </div>
  )
}
