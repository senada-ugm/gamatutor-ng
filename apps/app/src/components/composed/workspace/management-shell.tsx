import { Link, Outlet, useLocation, useMatchRoute } from "@tanstack/react-router"

import { cn } from "@workspace/ui/lib/utils"

import { WorkspaceShell } from "@/components/composed/workspace/workspace-shell"
import { useSession } from "@/lib/session"

/**
 * Management console shell for /instructor/**, /admin/**, and /institution/**.
 *
 * Implements a unified full-width shell consistent with the learner workspace:
 * - Shared global Sky Blue header and navigation menu via WorkspaceShell
 * - Context-aware vertical tab navigation (clean split between Admin platform tools and Instructor authoring)
 * - Zero unnecessary breadcrumb clutter
 */
export function ManagementShell() {
  const session = useSession()
  const location = useLocation()
  const matchRoute = useMatchRoute()

  const user = session.data ?? null
  const isAdmin = user?.role === "admin"

  const pathname = location.pathname
  const isAdminSection = pathname.startsWith("/admin")

  function verticalTabClass(active: boolean) {
    return cn(
      "flex w-full items-center justify-between gap-2.5 rounded-lg px-3.5 py-2.5 text-start text-sm font-medium transition-all",
      active
        ? "bg-[#0369a1] font-semibold text-white shadow-xs dark:bg-sky-600 dark:text-white"
        : "text-muted-foreground hover:bg-sky-50 hover:text-[#0369a1] dark:hover:bg-sky-950/40 dark:hover:text-sky-300"
    )
  }

  return (
    <WorkspaceShell>
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6 md:py-8">
        {/* 2-Column Full-Width Vertical Tab Layout */}
        <div className="flex flex-col gap-8 md:flex-row md:items-start">
          <aside className="w-full shrink-0 space-y-5 md:w-64 lg:w-72" aria-label="Navigasi Pengelolaan">
            {isAdminSection ? (
              /* Platform Admin Vertical Tabs */
              <div className="space-y-4">
                <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs dark:border-border/50">
                  <p className="text-xs font-bold tracking-wider text-[#0369a1] uppercase dark:text-sky-400">
                    Konsol Administrator
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Tata kelola platform &amp; keamanan</p>
                </div>

                <div className="space-y-1" data-sidebar="menu">
                  <Link
                    to="/admin"
                    data-sidebar="menu-button"
                    className={verticalTabClass(!!matchRoute({ to: "/admin", fuzzy: false }))}
                  >
                    <span>Ringkasan</span>
                  </Link>
                  <Link
                    to="/admin/users"
                    data-sidebar="menu-button"
                    className={verticalTabClass(!!matchRoute({ to: "/admin/users" }))}
                  >
                    <span>Pengguna</span>
                  </Link>
                  <Link
                    to="/admin/institutions"
                    data-sidebar="menu-button"
                    className={verticalTabClass(!!matchRoute({ to: "/admin/institutions" }))}
                  >
                    <span>Institusi</span>
                  </Link>
                  <Link
                    to="/admin/settings"
                    data-sidebar="menu-button"
                    className={verticalTabClass(!!matchRoute({ to: "/admin/settings" }))}
                  >
                    <span>Pengaturan</span>
                  </Link>
                </div>

                <div className="border-t border-border/50 pt-3">
                  <Link
                    to="/instructor"
                    className="flex items-center justify-between rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-[#0369a1] dark:hover:text-sky-300"
                  >
                    <span>Ke Menu Instruktur</span>
                    <span className="text-xs">➔</span>
                  </Link>
                </div>
              </div>
            ) : (
              /* Instructor & Institution Authoring Vertical Tabs */
              <div className="space-y-4">
                <div className="space-y-1" data-sidebar="menu">
                  <Link
                    to="/instructor"
                    data-sidebar="menu-button"
                    className={verticalTabClass(!!matchRoute({ to: "/instructor", fuzzy: true }))}
                  >
                    <span>Kelola Pelatihan</span>
                  </Link>
                  <Link
                    to="/institution"
                    data-sidebar="menu-button"
                    className={verticalTabClass(!!matchRoute({ to: "/institution" }))}
                  >
                    <span>Ringkasan Institusi</span>
                  </Link>
                  <Link
                    to="/institution/peserta"
                    data-sidebar="menu-button"
                    className={verticalTabClass(!!matchRoute({ to: "/institution/peserta" }))}
                  >
                    <span>Peserta</span>
                  </Link>
                </div>

                {isAdmin ? (
                  <div className="border-t border-border/50 pt-3">
                    <Link
                      to="/admin"
                      className="flex items-center justify-between rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-[#0369a1] dark:hover:text-sky-300"
                    >
                      <span>Ke Konsol Admin</span>
                      <span className="text-xs">➔</span>
                    </Link>
                  </div>
                ) : null}
              </div>
            )}
          </aside>

          {/* Main Content Area */}
          <main className="w-full min-w-0 flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </WorkspaceShell>
  )
}
