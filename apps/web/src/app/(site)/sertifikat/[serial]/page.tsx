import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/components/print-button';
import { getDb } from '@/db/client';
import type { CertificateSnapshot } from '@/db/schema';
import { certificateBySerial } from '@/server/learning';
import { baseUrl, requireUser } from '@/server/session';

export const metadata: Metadata = { title: 'Sertifikat' };

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });

export default async function CertificatePage({ params }: { params: Promise<{ serial: string }> }) {
  const { serial } = await params;
  const user = await requireUser(`/sertifikat/${serial}`);
  const found = await certificateBySerial(await getDb(), serial);
  if (!found || (found.userId !== user.id && user.role !== 'admin')) notFound();
  const s = found.cert.snapshot as CertificateSnapshot;
  const verifyUrl = `${await baseUrl()}/verify/${found.cert.serial}`;
  return (
    <>
      <div className="certificate">
        <div className="cert-eyebrow">SERTIFIKAT PENYELESAIAN</div>
        <h1>{s.brand}</h1>
        <p className="muted">Dengan ini menyatakan bahwa</p>
        <div className="cert-name">{s.name}</div>
        <p>{s.certificateText}</p>
        <div className="cert-meta">
          <div>
            <b>{longDate(s.issuedAt)}</b>Tanggal terbit
          </div>
          <div>
            <b>
              {s.scoreRaw} / {s.scoreMax}
            </b>
            Skor evaluasi
          </div>
        </div>
        <div className="cert-serial">
          No. {found.cert.serial} · Verifikasi: {verifyUrl}
        </div>
      </div>
      <div className="print-actions">
        <PrintButton />
        <Link className="btn btn-ghost" href={`/belajar/${found.courseSlug}`}>
          Kembali ke kursus
        </Link>
      </div>
    </>
  );
}
