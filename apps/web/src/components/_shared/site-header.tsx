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
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          LMS
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/courses" className="text-muted-foreground hover:text-foreground">
            Katalog
          </Link>
          <Link to="/certificates/verify" className="text-muted-foreground hover:text-foreground">
            Verifikasi Sertifikat
          </Link>
          <NativeAnchor href={`${APP_ORIGIN}/login`} variant="outline">
            Masuk
          </NativeAnchor>
        </nav>
      </div>
    </header>
  )
}
