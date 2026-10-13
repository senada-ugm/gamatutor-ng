import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/db/client';
import { courseReport } from '@/server/reports';
import { requireAdmin } from '@/server/session';
import { AdminResetButton } from '@/components/forms';
import { adminResetAction } from '../../../actions';
import { formatDuration, wibStamp } from '@/server/time-report';

export const metadata: Metadata = { title: 'Laporan kursus' };

const DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

/** Teal ramp from white; the heaviest cell is full teal. */
function heatColor(v: number, max: number): string {
  if (!v || !max) return '#f4f7f9';
  const a = 0.15 + 0.85 * (v / max);
  return `rgba(19, 122, 119, ${a.toFixed(2)})`;
}

export default async function CourseReportPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const report = await courseReport(await getDb(), slug);
  if (!report) notFound();
  const heatMax = Math.max(0, ...report.heatmap.flat());
  const dailyMax = Math.max(1, ...report.daily.map((d) => d.learners));
  return (
    <>
      <p className="small">
        <Link href="/admin">&larr; Admin</Link>
      </p>
      <h1>{report.course.title}</h1>
      <div className="stats">
        <div className="card stat">
          <b>{report.totals.enrolled}</b>
          <span>peserta terdaftar</span>
        </div>
        <div className="card stat">
          <b>{report.totals.started}</b>
          <span>sudah mulai belajar</span>
        </div>
        <div className="card stat">
          <b>{report.totals.passed}</b>
          <span>lulus evaluasi terakhir</span>
        </div>
        <div className="card stat">
          <b>{report.totals.certified}</b>
          <span>sertifikat terbit</span>
        </div>
        <div className="card stat">
          <b>{report.totals.medianActive}</b>
          <span>median waktu belajar aktif</span>
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Peserta</h2>
          <span className="small">
            Unduh CSV: <a href={`/admin/kursus/${slug}/export/peserta`}>ringkasan peserta</a> ·{' '}
            <a href={`/admin/kursus/${slug}/export/events`}>semua aktivitas (timestamp)</a>
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Profesi</th>
                <th>Instansi</th>
                <th>Akses pertama (WIB)</th>
                <th>Akses terakhir (WIB)</th>
                <th className="num">Sesi</th>
                <th className="num">Waktu aktif</th>
                <th className="num">Percobaan</th>
                <th>Skor terakhir</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {report.learners.length === 0 && (
                <tr>
                  <td colSpan={10} className="muted">
                    Belum ada peserta.
                  </td>
                </tr>
              )}
              {report.learners.map((l) => (
                <tr key={l.userId}>
                  <td>
                    {l.fullName}
                    <div className="small muted">{l.email}</div>
                    <AdminResetButton action={adminResetAction} userId={l.userId} />
                  </td>
                  <td>{l.profession}</td>
                  <td>
                    {l.institution}
                    <div className="small muted">
                      {l.city}, {l.province}
                    </div>
                  </td>
                  <td>{l.firstAt ? wibStamp(l.firstAt) : '—'}</td>
                  <td>{l.lastAt ? wibStamp(l.lastAt) : '—'}</td>
                  <td className="num">{l.sessions}</td>
                  <td className="num">{formatDuration(l.activeMs)}</td>
                  <td className="num">{l.attempts}</td>
                  <td>{l.lastScore || '—'}</td>
                  <td>
                    {l.certificate ? (
                      <Link href={`/sertifikat/${l.certificate}`}>Bersertifikat</Link>
                    ) : l.passed ? (
                      'Lulus'
                    ) : l.passed === false ? (
                      'Belum lulus'
                    ) : (
                      'Belum evaluasi'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>Kapan peserta belajar</h2>
        <p className="small muted">
          Menit belajar aktif per hari dan jam (WIB), dari seluruh peserta. Makin gelap, makin banyak.
        </p>
        <div className="table-wrap">
          <table className="heat" aria-label="Menit belajar aktif per hari dan jam">
            <thead>
              <tr>
                <th></th>
                {Array.from({ length: 24 }, (_, h) => (
                  <th key={h}>{String(h).padStart(2, '0')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.heatmap.map((row, d) => (
                <tr key={d}>
                  <th>{DAYS[d]}</th>
                  {row.map((v, h) => (
                    <td
                      key={h}
                      title={`${DAYS[d]} ${String(h).padStart(2, '0')}:00 — ${v} menit`}
                      style={{ background: heatColor(v, heatMax), color: v / (heatMax || 1) > 0.55 ? '#fff' : '#1d2b38' }}
                    >
                      {v || ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>Peserta aktif per hari (30 hari terakhir)</h2>
        <div className="card">
          <div className="bars" role="img" aria-label="Jumlah peserta aktif per hari">
            {report.daily.map((d) => (
              <div
                key={d.date}
                title={`${d.date}: ${d.learners} peserta`}
                style={{ height: `${(d.learners / dailyMax) * 100}%` }}
              />
            ))}
          </div>
          <div className="bars-axis">
            <span>{report.daily[0]?.date}</span>
            <span>maks. {dailyMax} peserta/hari</span>
            <span>{report.daily.at(-1)?.date}</span>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Waktu per modul</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Modul</th>
                <th className="num">Median menit aktif</th>
                <th className="num">Peserta</th>
              </tr>
            </thead>
            <tbody>
              {report.modules.map((m) => (
                <tr key={m.module}>
                  <td>{m.module}</td>
                  <td className="num">{m.medianMinutes}</td>
                  <td className="num">{m.learners}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          Waktu aktif = jumlah jeda antar-aktivitas, maksimal 5 menit per jeda; jeda di atas 30 menit dihitung sebagai sesi baru.
          Selama kursus terbuka di layar, sinyal aktivitas dikirim tiap menit.
        </p>
      </section>
    </>
  );
}
