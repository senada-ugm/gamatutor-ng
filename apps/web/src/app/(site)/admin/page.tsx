import type { Metadata } from 'next';
import Link from 'next/link';
import { getDb } from '@/db/client';
import { adminCourses } from '@/server/reports';
import { requireAdmin } from '@/server/session';

export const metadata: Metadata = { title: 'Admin' };

export default async function AdminPage() {
  await requireAdmin();
  const rows = await adminCourses(await getDb());
  return (
    <>
      <h1>Admin</h1>
      <p className="muted">
        Laporan peserta, lama belajar, dan waktu akses per kursus. Kursus baru diterbitkan dengan{' '}
        <code>pnpm web course:publish content/&lt;folder&gt; --topic retina</code>.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kursus</th>
              <th>Status</th>
              <th className="num">Peserta</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug}>
                <td>{r.title}</td>
                <td>{r.status === 'published' ? 'Terbit' : 'Disembunyikan'}</td>
                <td className="num">{r.learners}</td>
                <td>
                  <Link href={`/admin/kursus/${r.slug}`}>Laporan</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
