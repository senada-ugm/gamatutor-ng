import { Link } from "@tanstack/react-router"

import { Button } from "@workspace/ui/components/button"
import { useSession } from "@/lib/session"

/**
 * Public and marketing topbar matching GamaTutor's clinical visual language
 * as published on https://gamatutor.komunitech.id/:
 * - Eyeball logo mark (SVG iris/pupil in teal and amber)
 * - "DRIVE School di GamaTutor, SENADA UGM" wordmark
 * - Quiet text links with bottom accent underlines on hover
 * - Direct "Verifikasi Sertifikat" certificate verification shortcut
 * - Full authenticated/guest account actions
 */
export function SiteHeader() {
  const { data: user } = useSession()

  return (
    <header className="sticky top-0 z-40 border-b border-[#d5e1ea] bg-[#fbfdfe]/95 backdrop-blur-xs dark:border-slate-800 dark:bg-background/95">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6 md:px-8">
        <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight text-[#0f2a44] dark:text-white">
          <svg className="size-[30px] shrink-0" viewBox="0 0 30 30" aria-hidden="true" focusable="false">
            <circle cx="15" cy="15" r="13.5" fill="#eaf5f5" stroke="#5bb4b2" strokeWidth="1.5" />
            <circle cx="15" cy="15" r="6" fill="#137a77" />
            <circle cx="18.5" cy="13" r="2" fill="#f2902e" />
          </svg>
          <span className="sr-only">Logo DRIVE School</span>
          <span className="text-[1.125rem] font-extrabold tracking-tight text-[#0f2a44] dark:text-white">
            DRIVE School
          </span>
          <span className="ml-1 hidden text-sm font-medium text-[#6b8196] sm:inline dark:text-slate-400">
            di GamaTutor, SENADA UGM
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
