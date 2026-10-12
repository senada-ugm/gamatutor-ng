import { Link, useParams, useSearch } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { EmptyState } from "@/components/composed/_shared/empty-state"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { apiGet } from "@/lib/api"
import { formatCourseDate } from "@/lib/lms-date"
import type { ContractCertificate } from "@workspace/contracts/domain"

import { Printer } from "lucide-react"

/**
 * Certificate view (recipient/manager) and the public verification
 * lookup. Rendering stays client-side — print from the browser.
 */

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
        <PageHeader backTo="/dashboard" backLabel="Dasbor" />
        {certificate.data ? (
          <Button onClick={() => window.print()} variant="outline" className="gap-2">
            <Printer className="size-4" />
            Cetak / Simpan PDF
          </Button>
        ) : null}
      </div>
      {certificate.isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : certificate.isError ? (
        <ErrorState error={certificate.error} onRetry={() => void certificate.refetch()} />
      ) : certificate.data ? (
        <CertificateCard certificate={certificate.data} />
      ) : (
        <EmptyState title="Sertifikat tidak ditemukan" />
      )}
    </div>
  )
}

export function CertificateVerifyPage() {
  const { code } = useSearch({ from: "/workspace/learner/certificates/verify" })

  const certificate = useQuery({
    queryKey: ["certificate-verify", code],
    queryFn: () => apiGet<ContractCertificate>(`/certificates/verify?code=${encodeURIComponent(code ?? "")}`),
    enabled: code !== "",
    retry: false,
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Verifikasi Sertifikat" description="Masukkan nomor sertifikat atau kode verifikasi." />

      <form method="get" className="flex max-w-md gap-2">
        <Input
          name="code"
          defaultValue={code}
          aria-label="Nomor atau kode verifikasi"
          placeholder="Nomor / kode verifikasi"
        />
        <Button type="submit">Periksa</Button>
      </form>

      {!code ? null : certificate.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : certificate.data ? (
        <div className="space-y-3">
          <Badge>Sah</Badge>
          <CertificateCard certificate={certificate.data} />
        </div>
      ) : (
        <EmptyState title="Tidak ditemukan" description="Kode tersebut tidak cocok dengan sertifikat apa pun." />
      )}
    </div>
  )
}

function CertificateCard({ certificate }: { certificate: ContractCertificate }) {
  return (
    <Card className="print:border-0 print:shadow-none">
      <CardContent className="space-y-6 text-center">
        <div>
          <p className="text-xs tracking-widest text-muted-foreground uppercase">Sertifikat Kelulusan</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{certificate.title}</p>
        </div>
        <p className="text-lg">Diberikan kepada</p>
        <p className="text-2xl font-semibold">{certificate.user.name}</p>
        <p className="text-sm text-muted-foreground">
          atas keberhasilan menyelesaikan pelatihan{" "}
          <span className="font-medium text-foreground">{certificate.course.title}</span> yang diselenggarakan oleh{" "}
          {certificate.institution.name}
        </p>
        <div className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Nomor Sertifikat</p>
            <p className="font-mono">{certificate.certificateNumber}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Kode Verifikasi</p>
            <p className="font-mono">{certificate.verificationCode}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tanggal Terbit</p>
            <p>{formatCourseDate(certificate.issuedAt, { dateOnly: true })}</p>
          </div>
        </div>
        <div className="flex justify-center gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            Cetak / Simpan PDF
          </Button>
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link to="/certificates/verify" search={{ code: certificate.verificationCode }} />}
          >
            Halaman Verifikasi
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
