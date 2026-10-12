import { createFileRoute } from "@tanstack/react-router"

import { APP_ORIGIN } from "@/lib/env"

/**
 * Auth lives in the SPA (apps/app) — this route only exists so legacy
 * links land somewhere, bouncing to the SPA's login with the session
 * handoff. SSR-safe: a meta refresh plus an anchor fallback, no
 * client JS required.
 */
export const Route = createFileRoute("/login/")({
  head: () => ({ meta: [{ httpEquiv: "refresh", content: `0; url=${APP_ORIGIN}/login` }] }),
  component: () => (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-muted-foreground">Mengalihkan ke halaman masuk…</p>
      <a href={`${APP_ORIGIN}/login`} className="text-primary underline">
        Klik di sini jika tidak dialihkan
      </a>
    </main>
  ),
})
