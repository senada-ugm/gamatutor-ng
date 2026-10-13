import { Link } from "@tanstack/react-router"
import { NativeAnchor } from "@workspace/ui/composed/native-anchor"

import { APP_ORIGIN } from "@/lib/env"

/**
 * Public site header. Matches GamaTutor's topbar gradient and brand mark:
 * linear-gradient(120deg, var(--teal) 0%, var(--blue) 60%, var(--navy) 100%)
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-[#5bb4b2] via-[#2d77c2] to-[#173a5e] text-white shadow-xs">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight text-white hover:opacity-95">
          <span className="flex size-7 items-center justify-center rounded-full border-2 border-white text-xs font-bold select-none">
            👁
          </span>
          <span className="text-base font-extrabold tracking-tight">GamaTutor</span>
          <span className="hidden border-l border-white/30 pl-2.5 text-xs font-medium text-white/80 sm:inline">
            SENADA UGM
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/courses" className="text-white/90 transition-colors hover:text-white hover:underline">
            Katalog
          </Link>
          <Link to="/certificates/verify" className="text-white/90 transition-colors hover:text-white hover:underline">
            Verifikasi Sertifikat
          </Link>
          <NativeAnchor
            href={`${APP_ORIGIN}/login`}
            variant="outline"
            size="sm"
            className="border-white/70 bg-white/10 font-semibold text-white hover:bg-white hover:text-slate-900"
          >
            Masuk Portal
          </NativeAnchor>
        </nav>
      </div>
    </header>
  )
}
