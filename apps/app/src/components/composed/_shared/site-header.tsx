import { Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { DriveLogo } from "@/components/composed/_shared/drive-logo"
import { useSession } from "@/lib/session"

/**
 * Public and marketing topbar matching GamaTutor's clinical visual language
 * as published on https://gamatutor.komunitech.id/:
 * - DRIVE Learn brand mark: the DRIVE logo + "Learn" (matching app layout top nav)
 * - Quiet text links with bottom accent underlines on hover
 * - Direct "Verifikasi Sertifikat" certificate verification shortcut
 * - Full authenticated/guest account actions
 */
export function SiteHeader() {
  const { data: user } = useSession()

  return (
    <header className="sticky top-0 z-40 border-b border-[#d5e1ea] bg-[#fbfdfe]/95 backdrop-blur-xs dark:border-slate-800 dark:bg-background/95">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6 md:px-8">
        <Link
          to="/"
          className="flex shrink-0 items-center transition-opacity hover:opacity-95"
          aria-label="DRIVE Learn — Beranda"
        >
          <DriveLogo logoClassName="h-8" />
        </Link>

        <nav className="flex items-center gap-5 text-sm font-semibold" aria-label="Navigasi utama">
          <Link
            to="/courses"
            className="text-[#46607a] transition-colors hover:text-[#137a77] hover:underline hover:decoration-[#5bb4b2] hover:decoration-2 hover:underline-offset-4 dark:text-slate-300 dark:hover:text-teal-400"
          >
            Kursus
          </Link>
          <Link
            to="/certificates/verify"
            className="text-[#46607a] transition-colors hover:text-[#137a77] hover:underline hover:decoration-[#5bb4b2] hover:decoration-2 hover:underline-offset-4 dark:text-slate-300 dark:hover:text-teal-400"
          >
            Verifikasi Sertifikat
          </Link>

          {user ? (
            <Button size="sm" nativeButton={false} render={<Link to="/dashboard" />}>
              Beranda
            </Button>
          ) : (
            <Button size="sm" nativeButton={false} render={<Link to="/login" />}>
              Masuk
            </Button>
          )}
        </nav>
      </div>
    </header>
  )
}
