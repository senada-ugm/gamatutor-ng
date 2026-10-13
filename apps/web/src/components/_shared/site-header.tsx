import { Link } from "@tanstack/react-router"
import { NativeAnchor } from "@workspace/ui/composed/native-anchor"

import { APP_ORIGIN } from "@/lib/env"

/**
 * Public site header. Auth CTAs hand off to the authenticated SPA
 * (apps/app) — plain external anchors, since this site holds no
 * session. Plain HTML links (no Base UI Button) keep SSR event-free.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground shadow-xs">
            GT
          </span>
          <span className="text-base font-bold text-foreground">GamaTutor</span>
          <span className="hidden border-l pl-2.5 text-xs font-medium text-muted-foreground sm:inline">
            DRIVE FKKMK UGM
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/courses" className="text-muted-foreground transition-colors hover:text-foreground">
            Katalog
          </Link>
          <Link to="/certificates/verify" className="text-muted-foreground transition-colors hover:text-foreground">
            Verifikasi Sertifikat
          </Link>
          <NativeAnchor href={`${APP_ORIGIN}/login`} variant="outline" size="sm">
            Masuk Portal
          </NativeAnchor>
        </nav>
      </div>
    </header>
  )
}
