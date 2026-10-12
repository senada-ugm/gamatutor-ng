import { Link, Outlet, useMatchRoute, useNavigate } from "@tanstack/react-router"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"

import { NotificationBell } from "@/components/composed/notifications/notification-bell"
import { InstitutionSwitcher } from "@/components/composed/institutions/institution-switcher"
import { ALL_INSTITUTIONS, useAuthoringScope } from "@/lib/authoring-institution"
import { useSession } from "@/lib/session"
import { signOut } from "@/lib/auth"

/**
 * Chrome for the management console (/instructor/**, /admin/**).
 *
 * The learner surfaces keep the top nav: a learner's whole path is
 * catalog -> course -> player and the player owns a sidebar, so a second
 * persistent rail there would be chrome tax on every page; management
 * has a scope and a growing set of destinations, so it gets the rail.
 * Don't collapse the two back into one shell without resolving that.
 *
 * The sidebar header carries the institution scope (see
 * lib/authoring-institution.ts), and its groups mean something:
 * everything above "Platform" is scoped by that switcher, everything
 * under it is admin-wide and ignores the scope.
 */
function readSidebarCookie(): boolean {
  if (typeof document === "undefined") return true
  const match = document.cookie.match(/(?:^|;\s*)sidebar_state=(true|false)/)
  return match ? match[1] === "true" : true
}

export function ManagementShell() {
  const session = useSession()
  const navigate = useNavigate()
  const matchRoute = useMatchRoute()
  const scope = useAuthoringScope()

  const user = session.data ?? null
  const isAdmin = user?.role === "admin"
  const isAllInstitutions = scope.scopeId === ALL_INSTITUTIONS
  const initial = (user?.name ?? user?.email ?? "A").charAt(0).toUpperCase()

  async function handleSignOut() {
    await signOut()
    navigate({ to: "/login" })
  }

  return (
    <SidebarProvider defaultOpen={readSidebarCookie()}>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="gap-2">
          <Link to="/dashboard" className="px-2 py-1 font-semibold tracking-tight">
            LMS
          </Link>
          <InstitutionSwitcher block />
        </SidebarHeader>

        <SidebarContent>
          {/* Labelled now that it holds four entries: without it the
              institution's "Ringkasan" and the platform's read as the
              same destination. The label is also what says these four
              follow the switcher above them. */}
          <SidebarGroup>
            <SidebarGroupLabel>Institusi</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={!!matchRoute({ to: "/institution" })}
                    render={<Link to="/institution" />}
                  >
                    <span>Ringkasan</span>
                    {isAllInstitutions ? (
                      <span className="ml-auto text-xs font-normal text-muted-foreground">Per Institusi</span>
                    ) : null}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={!!matchRoute({ to: "/instructor", fuzzy: true })}
                    render={<Link to="/instructor" />}
                  >
                    Kelola Pelatihan
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={!!matchRoute({ to: "/institution/peserta" })}
                    render={<Link to="/institution/peserta" />}
                  >
                    <span>Peserta</span>
                    {isAllInstitutions ? (
                      <span className="ml-auto text-xs font-normal text-muted-foreground">Per Institusi</span>
                    ) : null}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={!!matchRoute({ to: "/institution/pembayaran" })}
                    render={<Link to="/institution/pembayaran" />}
                  >
                    <span>Pembayaran</span>
                    {isAllInstitutions ? (
                      <span className="ml-auto text-xs font-normal text-muted-foreground">Per Institusi</span>
                    ) : null}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {isAdmin ? (
            <SidebarGroup>
              <SidebarGroupLabel>Platform</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={!!matchRoute({ to: "/admin", fuzzy: false })}
                      render={<Link to="/admin" />}
                    >
                      Ringkasan
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={!!matchRoute({ to: "/admin/users" })}
                      render={<Link to="/admin/users" />}
                    >
                      Pengguna
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={!!matchRoute({ to: "/admin/institutions" })}
                      render={<Link to="/admin/institutions" />}
                    >
                      Institusi
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={!!matchRoute({ to: "/admin/assessments" })}
                      render={<Link to="/admin/assessments" />}
                    >
                      Asesmen
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={!!matchRoute({ to: "/admin/settings" })}
                      render={<Link to="/admin/settings" />}
                    >
                      Pengaturan
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={!!matchRoute({ to: "/admin/audit" })}
                      render={<Link to="/admin/audit" />}
                    >
                      Audit
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}

          {/* Leaving the console is a nav destination, not a setting.
              Following one of these swaps back to the top-nav shell,
              which the group label is there to telegraph. */}
          <SidebarGroup>
            <SidebarGroupLabel>Belajar</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link to="/dashboard" />}>Dasbor</SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link to="/courses" />}>Katalog</SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link to="/wishlist" />}>Wishlist</SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link to="/orders" />}>Pesanan Saya</SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link to="/assessments" />}>Asesmen</SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link to="/certificates/verify" />}>
                    Verifikasi Sertifikat
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger render={<SidebarMenuButton size="lg" aria-label="Menu Akun" />}>
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs font-medium">{initial}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 text-start">
                    <span className="block truncate text-sm font-medium">{user?.name ?? "Akun"}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {isAdmin ? "Administrator" : (user?.email ?? "")}
                    </span>
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" className="w-56">
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
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4 md:px-6">
          <SidebarTrigger />
          <NotificationBell />
        </header>
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
