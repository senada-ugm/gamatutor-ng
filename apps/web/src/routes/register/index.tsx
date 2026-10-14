import { createFileRoute } from "@tanstack/react-router"

import { APP_ORIGIN } from "@/lib/env"

/** See /login — registration lives in the SPA. */
export const Route = createFileRoute("/register/")({
  head: () => ({ meta: [{ httpEquiv: "refresh", content: `0; url=${APP_ORIGIN}/register` }] }),
  component: () => (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-muted-foreground">Mengalihkan ke halaman pendaftaran…</p>
      <a href={`${APP_ORIGIN}/register`} className="text-primary underline">
        Klik di sini jika tidak dialihkan
      </a>
    </main>
  ),
})
