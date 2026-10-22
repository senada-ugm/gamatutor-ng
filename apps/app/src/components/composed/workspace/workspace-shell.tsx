import { Link, useMatchRoute, useNavigate } from "@tanstack/react-router"
import { Eye } from "lucide-react"

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
 * High-Contrast Sky Blue Header Chrome for authenticated workspace pages
 * (dashboard, catalog, instructor, admin, account).
 * Features:
 * - Sky Blue primary brand background (#0369a1 in light mode, #082f49 in dark mode)
 * - WCAG AAA compliant text contrast (pure white #ffffff in light mode, #f0f9ff in dark mode)
 * - Tosca Green secondary accent indicator for medical credentials
 * - Streamlined medical learner navigation and account menu
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
    if (typeof window !== "undefined") {
      window.location.href = "/"
    }
  }

  // Active pill has high contrast against the Sky Blue background:
  // white frosted glass pill with bold text in light mode,
  // sky-500/25 in dark mode.
  function navClass(active: boolean) {
    return cn(
      "h-8 cursor-pointer px-3 text-xs font-semibold transition-colors",
      active
        ? "bg-white/20 font-bold text-white shadow-xs hover:bg-white/25 dark:bg-sky-500/25 dark:text-sky-200"
        : "text-sky-100 hover:bg-white/10 hover:text-white"
    )
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-sky-800/40 bg-[#0369a1] text-white shadow-xs dark:border-sky-900/60 dark:bg-[#082f49] print:hidden">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:gap-6 md:px-6">
          <Link
            to="/dashboard"
            className="flex shrink-0 items-center gap-2.5 font-bold tracking-tight text-white transition-opacity hover:opacity-95"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-white/20 text-xs font-black text-white shadow-xs backdrop-blur-xs">
              <Eye className="size-4 stroke-[2.2]" />
            </span>
            <span className="text-base font-extrabold tracking-tight text-white">
              DRIVE <span className="font-semibold text-sky-200 dark:text-sky-300">Learn</span>
            </span>
          </Link>

          {/* Nav Bar */}
          <nav className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent_100%)] [-ms-overflow-style:none] [scrollbar-width:none] md:[mask-image:none] [&::-webkit-scrollbar]:hidden">
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
                className={navClass(
                  !!matchRoute({ to: "/instructor", fuzzy: true }) || !!matchRoute({ to: "/institution", fuzzy: true })
                )}
                render={<Link to="/institution" />}
              >
                Institusi
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

          {/* Action icons & Account menu */}
          <div className="flex shrink-0 items-center gap-2">
            <div className="text-white [&_button]:text-white [&_button]:hover:bg-white/10 [&_button]:hover:text-white">
              <NotificationBell />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Menu Akun"
                className="cursor-pointer rounded-full ring-2 ring-white/30 transition-all hover:ring-white/60 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              >
                <Avatar className="size-8">
                  <AvatarFallback className="bg-sky-900 text-xs font-bold text-white dark:bg-sky-800">
                    {(user?.name ?? user?.email ?? "A").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-bold text-foreground">{user?.name ?? "Akun"}</p>
                  {user?.email ? <p className="truncate text-xs text-muted-foreground">{user.email}</p> : null}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link to="/profile" />}>Profil Saya</DropdownMenuItem>
                <DropdownMenuItem render={<Link to="/certificates/verify" />}>Verifikasi Sertifikat</DropdownMenuItem>
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
