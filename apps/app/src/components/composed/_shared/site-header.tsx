import { Link } from "@tanstack/react-router"
import { Eye } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { useSession } from "@/lib/session"

/**
 * Public and marketing topbar matching GamaTutor's clinical visual language
 * as published on https://gamatutor.komunitech.id/:
 * - DRIVE Learn brand mark with eye icon (matching app layout top nav)
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
          className="flex shrink-0 items-center gap-2.5 font-bold tracking-tight text-[#0f2a44] transition-opacity hover:opacity-95 dark:text-white"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-[#0369a1] text-xs font-black text-white shadow-xs">
            <Eye className="size-4 stroke-[2.2]" />
          </span>
          <span className="text-base font-extrabold tracking-tight text-[#0f2a44] dark:text-white">
            DRIVE <span className="font-semibold text-[#0369a1] dark:text-sky-400">Learn</span>
          </span>
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
