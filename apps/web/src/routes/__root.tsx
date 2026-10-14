import { HeadContent, Scripts, createRootRoute, Link } from "@tanstack/react-router"
import appCss from "@workspace/ui/globals.css?url"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "LMS — Portal Pelatihan" },
      {
        name: "description",
        content:
          "Platform pelatihan kerja resmi: jelajahi pelatihan dari institusi mitra, daftar online, dan dapatkan sertifikat.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Halaman tidak ditemukan.</p>
      <Link to="/" className="text-primary underline">
        Kembali ke beranda
      </Link>
    </main>
  ),
  errorComponent: ({ error }) => (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Terjadi kesalahan</h1>
      <p className="text-muted-foreground">{error instanceof Error ? error.message : "Silakan coba lagi."}</p>
      <Link to="/" className="text-primary underline">
        Kembali ke beranda
      </Link>
    </main>
  ),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
