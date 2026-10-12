import { createFileRoute } from "@tanstack/react-router"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardAction, CardContent, CardHeader } from "@workspace/ui/components/card"
import { NativeButton } from "@workspace/ui/composed/native-button"
import { NativeInput } from "@workspace/ui/composed/native-input"

import { PageHeader } from "@/components/_shared/page-header"
import { SiteHeader } from "@/components/_shared/site-header"
import { getServerCertificateVerify } from "@/lib/server-api"
import type { ContractCertificate } from "@workspace/contracts/domain"

/**
 * Public certificate verification — anyone can confirm a certificate is
 * real by its number or verification code. Fully SSR: the lookup runs
 * in the loader, so the result is in the HTML (and shareable as a link
 * with ?code=).
 */
export const Route = createFileRoute("/certificates/verify")({
  validateSearch: (search: Record<string, unknown>): { code?: string } => ({
    code: typeof search.code === "string" ? search.code : undefined,
  }),
  loaderDeps: ({ search: { code } }) => ({ code }),
  loader: async ({ deps: { code } }) => {
    if (!code) return { certificate: null as ContractCertificate | null, code: "" }
    const certificate = (await getServerCertificateVerify({
      data: code,
    })) as ContractCertificate | null
    return { certificate, code }
  },
  head: () => ({
    meta: [
      { title: "Verifikasi Sertifikat" },
      {
        name: "description",
        content: "Periksa keaslian sertifikat pelatihan berdasarkan nomor atau kode verifikasi.",
      },
    ],
  }),
  component: VerifyPage,
})

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
}

function VerifyPage() {
  const { certificate, code } = Route.useLoaderData()

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-12 md:px-6">
          <PageHeader
            title="Verifikasi Sertifikat"
            description="Masukkan nomor sertifikat atau kode verifikasi untuk memeriksa keasliannya."
          />

          <form method="get" className="flex gap-2">
            <NativeInput
              type="text"
              name="code"
              defaultValue={code}
              placeholder="Nomor / kode verifikasi"
              aria-label="Nomor atau kode verifikasi"
              className="h-10 flex-1"
            />
            <NativeButton type="submit" size="lg" className="px-6">
              Periksa
            </NativeButton>
          </form>

          {code ? (
            certificate ? (
              <Card>
                <CardHeader>
                  <p className="text-xs tracking-widest text-muted-foreground uppercase">Sertifikat Kelulusan</p>
                  <CardAction>
                    <Badge>Sah</Badge>
                  </CardAction>
                </CardHeader>
                <CardContent className="space-y-3 text-center">
                  <h2 className="text-xl font-bold">{certificate.title}</h2>
                  <p className="text-lg font-semibold">{certificate.user.name}</p>
                  <p className="text-sm text-muted-foreground">
                    menyelesaikan pelatihan {certificate.course.title} di {certificate.institution.name}
                  </p>
                  <div className="grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Nomor Sertifikat</p>
                      <p className="font-mono">{certificate.certificateNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tanggal Terbit</p>
                      <p>{new Date(certificate.issuedAt).toLocaleDateString("id-ID", DATE_FORMAT)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Kode Verifikasi</p>
                      <p className="font-mono">{certificate.verificationCode}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center text-sm text-muted-foreground">
                  Tidak ditemukan — kode tersebut tidak cocok dengan sertifikat apa pun.
                </CardContent>
              </Card>
            )
          ) : null}
        </div>
      </main>
    </div>
  )
}
