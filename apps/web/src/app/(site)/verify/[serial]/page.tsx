import type { Metadata } from 'next';
import { getDb } from '@/db/client';
import type { CertificateSnapshot } from '@/db/schema';
import { certificateBySerial } from '@/server/learning';

export const metadata: Metadata = { title: 'Verifikasi sertifikat', robots: { index: false } };

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ serial: string }>;
}) {
  const { serial } = await params;
  const found = await certificateBySerial(await getDb(), serial);
  if (!found) {
    return (
      <div className="narrow" style={{ margin: '0 auto' }}>
        <h1>Verifikasi sertifikat</h1>
        <p className="notice err">Tidak ada sertifikat dengan nomor {serial.toUpperCase()}.</p>
      </div>
    );
  }
  const s = found.cert.snapshot as CertificateSnapshot;
  return (
    <div className="narrow" style={{ margin: '0 auto' }}>
      <h1>Verifikasi sertifikat</h1>
      <div className="card">
        <p className="notice ok">Sertifikat ini tercatat dan diterbitkan oleh {s.brand}.</p>
        {found.identityVerifiedAt ? (
          <p className="notice ok">
            Identitas pemegang sudah diverifikasi penyelenggara pada{' '}
            {found.identityVerifiedAt.toLocaleDateString('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' })}.
          </p>
        ) : (
          <p className="notice info">
            Identitas pemegang <b>belum diverifikasi</b> penyelenggara. Nama di bawah ini diisi sendiri oleh peserta saat
            mendaftar.
          </p>
        )}
        <table>
          <tbody>
            <tr>
              <th>Nomor</th>
              <td>{found.cert.serial}</td>
            </tr>
            <tr>
              <th>Nama</th>
              <td>{s.name}</td>
            </tr>
            <tr>
              <th>Pelatihan</th>
              <td>{s.courseTitle}</td>
            </tr>
            <tr>
              <th>Skor</th>
              <td>
                {s.scoreRaw} / {s.scoreMax}
              </td>
            </tr>
            <tr>
              <th>Tanggal terbit</th>
              <td>
                {new Date(s.issuedAt).toLocaleDateString('id-ID', {
                  dateStyle: 'long',
                  timeZone: 'Asia/Jakarta',
                })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
