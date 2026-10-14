import { Link, useParams, useSearch } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Printer, ShieldCheck } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { EmptyState } from "@/components/composed/_shared/empty-state"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { SiteFooter } from "@/components/composed/_shared/site-footer"
import { SiteHeader } from "@/components/composed/_shared/site-header"
import { apiGet } from "@/lib/api"
import { formatCourseDate } from "@/lib/lms-date"
import type { ContractCertificate } from "@workspace/contracts/domain"

export function CertificateViewPage() {
  const { certificateId } = useParams({
    from: "/workspace/learner/certificates/$certificateId",
  })

  const certificate = useQuery({
    queryKey: ["certificate", certificateId],
    queryFn: () => apiGet<ContractCertificate>(`/certificates/${certificateId}`),
    retry: false,
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <PageHeader backTo="/dashboard" backLabel="Dasbor" title="Sertifikat Kelulusan" />
        {certificate.data ? (
          <div className="flex gap-2">
            <Button onClick={() => window.print()} className="gap-2 bg-[#173a5e] text-white hover:bg-[#132d47]">
              <Printer className="size-4" />
              Cetak / Simpan PDF
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link to="/learn/$courseId" params={{ courseId: certificate.data.courseId }} />}
            >
              Kembali ke Pelatihan
            </Button>
          </div>
        ) : null}
      </div>

      {certificate.isLoading ? (
        <Skeleton className="h-[500px] w-full" />
      ) : certificate.isError ? (
        <ErrorState error={certificate.error} onRetry={() => void certificate.refetch()} />
      ) : certificate.data ? (
        <CertificateFrame certificate={certificate.data} />
      ) : (
        <EmptyState title="Sertifikat tidak ditemukan" />
      )}
    </div>
  )
}

export function CertificateVerifyPage() {
  const { code } = useSearch({ from: "/certificates/verify" })

  const certificate = useQuery({
    queryKey: ["certificate-verify", code],
    queryFn: () => apiGet<ContractCertificate>(`/certificates/verify?code=${encodeURIComponent(code ?? "")}`),
    enabled: code !== "" && code != null,
    retry: false,
  })

  return (
    <div className="flex min-h-svh flex-col bg-[#f4f7f9] text-foreground dark:bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 md:py-10">
          <PageHeader
            title="Verifikasi Sertifikat Resmi"
            description="Masukkan nomor sertifikat atau kode anti-tamper untuk memvalidasi keaslian dokumen kelulusan klinis."
          />

          <form method="get" className="flex max-w-md gap-2">
            <Input
              name="code"
              defaultValue={code}
              aria-label="Nomor sertifikat atau kode verifikasi"
              placeholder="contoh: CRT-2026-XXXX atau kode verifikasi"
            />
            <Button type="submit" className="bg-[#173a5e] text-white hover:bg-[#132d47]">
              Verifikasi
            </Button>
          </form>

          {!code ? null : certificate.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : certificate.data ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                <ShieldCheck className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  <span className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">Sah</span>
                  <span>
                    Sertifikat Terverifikasi Asli — Diterbitkan resmi oleh {certificate.data.institution.name}
                  </span>
                </div>
              </div>
              <CertificateFrame certificate={certificate.data} isPublicView />
            </div>
          ) : (
            <EmptyState
              title="Sertifikat Tidak Ditemukan"
              description="Kode verifikasi yang dimasukkan tidak cocok dengan catatan sertifikat resmi di sistem."
            />
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

function CertificateFrame({
  certificate,
  isPublicView = false,
}: {
  certificate: ContractCertificate
  isPublicView?: boolean
}) {
  return (
    <div className="relative mx-auto max-w-4xl border-[10px] border-[#132d47] bg-white p-8 text-center shadow-xl sm:p-14 dark:bg-card print:m-0 print:max-w-none print:border-[10px] print:border-[#132d47] print:shadow-none">
      {/* Bingkai aksen dalam Retina Teal */}
      <div className="pointer-events-none absolute inset-3 border-2 border-[#5bb4b2]" />

      <div className="relative z-10 space-y-6">
        <div>
          <p className="text-xs font-bold tracking-[0.25em] text-[#2d77c2] uppercase">Sertifikat Kelulusan</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-[#132d47] sm:text-3xl dark:text-foreground">
            {certificate.institution.name}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">Departemen Ilmu Kesehatan Mata & Program DRIVE UGM</p>
        </div>

        <p className="text-sm text-muted-foreground italic">Dengan ini menyatakan bahwa</p>

        <div>
          <div className="my-1 inline-block border-b-2 border-slate-300 px-8 pb-2 font-serif text-3xl font-bold tracking-tight text-[#132d47] sm:text-4xl dark:text-foreground">
            {certificate.user.name}
          </div>
        </div>

        <p className="mx-auto max-w-xl text-sm leading-relaxed text-foreground/80">
          Telah berhasil menyelesaikan seluruh modul pembelajaran, evaluasi gambar klinis, dan uji kompetensi pada
          pelatihan:
        </p>

        <div className="mx-auto max-w-lg rounded-xl bg-slate-50 p-4 dark:bg-muted/40">
          <p className="text-lg font-bold text-[#173a5e] dark:text-blue-300">{certificate.course.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Terakreditasi Kementerian Kesehatan & Tim Ahli Oftalmologi Indonesia
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t pt-4 text-xs sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Tanggal Terbit</p>
            <p className="mt-0.5 font-bold text-foreground">
              {formatCourseDate(certificate.issuedAt, { dateOnly: true })}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">No. Sertifikat</p>
            <p className="mt-0.5 font-mono font-bold text-foreground">{certificate.certificateNumber}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Kode Validasi</p>
            <p className="mt-0.5 font-mono font-bold text-foreground">{certificate.verificationCode}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Status Identitas</p>
            <p className="mt-0.5 font-bold text-emerald-600 dark:text-emerald-400">Terverifikasi</p>
          </div>
        </div>

        <div className="pt-2 text-[11px] text-muted-foreground">
          Verifikasi keaslian publik:{" "}
          <span className="font-mono text-primary">/certificates/verify?code={certificate.verificationCode}</span>
        </div>

        {!isPublicView ? (
          <div className="flex justify-center gap-3 pt-4 print:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="gap-2 border-[#173a5e] text-[#173a5e] hover:bg-slate-50"
            >
              <Printer className="size-4" />
              Cetak Sertifikat
            </Button>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link to="/certificates/verify" search={{ code: certificate.verificationCode }} />}
            >
              Tinjau Halaman Publik
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
