import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminResetButton } from '@/components/forms';
import { getDb } from '@/db/client';
import { listPeople } from '@/server/people';
import { requireAdmin } from '@/server/session';
import { wibStamp } from '@/server/time-report';
import { adminIdentityAction, adminResetAction } from '../../actions';

export const metadata: Metadata = { title: 'Peserta' };

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q = '' } = await searchParams;
  const people = await listPeople(await getDb(), q);
  const unchecked = people.filter((p) => !p.identityVerifiedAt && p.role === 'learner').length;
  return (
    <>
      <p className="small">
        <Link href="/admin">&larr; Admin</Link>
      </p>
      <h1>Peserta</h1>
      <p className="muted">
        Karena email belum diverifikasi lewat server email, siapa pun bisa mendaftar dengan nama dan email apa saja.
        Cocokkan peserta dengan daftar peserta resmi Tim DRIVE, lalu tandai <b>identitas terverifikasi</b>. Halaman
        verifikasi sertifikat publik menampilkan status ini.
      </p>
      <form className="actions" style={{ marginBottom: 16 }}>
        <div className="field" style={{ flex: '1 1 260px' }}>
          <label htmlFor="q">Cari nama, email, atau instansi</label>
          <input id="q" name="q" defaultValue={q} />
        </div>
        <button className="btn" type="submit" style={{ alignSelf: 'flex-end' }}>
          Cari
        </button>
      </form>
      <p className="small muted">
        {people.length} akun ditampilkan · {unchecked} peserta belum diverifikasi identitasnya
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nama</th>
              <th>Profesi / instansi</th>
              <th>Telepon</th>
              <th>Terdaftar (WIB)</th>
              <th>Identitas</th>
              <th>Kata sandi</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.fullName}
                  {p.role === 'admin' && <span className="pill berjalan" style={{ marginLeft: 6 }}>admin</span>}
                  <div className="small muted">{p.email}</div>
                </td>
                <td>
                  {p.profession}
                  <div className="small muted">
                    {p.institution} · {p.city}, {p.province}
                  </div>
                </td>
                <td>{p.phone}</td>
                <td>{wibStamp(p.createdAt)}</td>
                <td>
                  <form action={adminIdentityAction}>
                    <input type="hidden" name="userId" value={p.id} />
                    {p.identityVerifiedAt ? (
                      <>
                        <span className="pill lulus">Terverifikasi</span>{' '}
                        <button className="linkbtn" style={{ color: 'var(--ink-faint)', padding: 0 }} type="submit">
                          batalkan
                        </button>
                      </>
                    ) : (
                      <>
                        <input type="hidden" name="verified" value="1" />
                        <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 13 }} type="submit">
                          Tandai terverifikasi
                        </button>
                      </>
                    )}
                  </form>
                </td>
                <td>
                  <AdminResetButton action={adminResetAction} userId={p.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
