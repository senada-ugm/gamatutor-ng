import { Link, Outlet, useLocation, useMatchRoute } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"

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
      "flex w-full items-center justify-between gap-1.5 rounded-md px-3 py-2 text-start text-base font-medium transition-all",
      active
        ? "bg-[#0369a1] font-semibold text-white shadow-xs dark:bg-sky-600 dark:text-white"
        : "text-muted-foreground hover:bg-sky-50 hover:text-[#0369a1] dark:hover:bg-sky-950/40 dark:hover:text-sky-300"
    )
  }

  return (
    <WorkspaceShell>
      {/* 2-Column Vertical Tab Layout without redundant wrapper padding (WorkspaceShell already provides padding) */}
      <div className="flex flex-col gap-6 md:flex-row md:items-start lg:gap-8">
        <aside className="w-full shrink-0 space-y-3 md:w-40 lg:w-44" aria-label="Navigasi Pengelolaan">
          {isAdminSection ? (
            /* Platform Admin Vertical Tabs */
            <div className="space-y-3">
              <div className="rounded-lg border border-border/70 bg-card p-2.5 shadow-2xs dark:border-border/50">
                <p className="text-[10px] font-bold tracking-wider text-[#0369a1] uppercase dark:text-sky-400">
                  Konsol Administrator
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Tata kelola &amp; keamanan</p>
              </div>

              <div className="space-y-0.5" data-sidebar="menu">
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

              <div className="border-t border-border/50 pt-2.5">
                <Link
                  to="/institution"
                  className="flex items-center justify-between rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-[#0369a1] dark:hover:text-sky-300"
                >
                  <span>Ke Institusi</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            /* Instructor & Institution Authoring Vertical Tabs */
            <div className="space-y-3">
              <div className="space-y-0.5" data-sidebar="menu">
                <Link
                  to="/institution"
                  data-sidebar="menu-button"
                  className={verticalTabClass(!!matchRoute({ to: "/institution" }))}
                >
                  <span>Institusi</span>
                </Link>
                <Link
                  to="/instructor"
                  data-sidebar="menu-button"
                  className={verticalTabClass(!!matchRoute({ to: "/instructor", fuzzy: true }))}
                >
                  <span>Pelatihan</span>
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
                <div className="border-t border-border/50 pt-2.5">
                  <Link
                    to="/admin"
                    className="flex items-center justify-between rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-[#0369a1] dark:hover:text-sky-300"
                  >
                    <span>Ke Konsol Admin</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              ) : null}
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <div className="w-full min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </WorkspaceShell>
  )
}
