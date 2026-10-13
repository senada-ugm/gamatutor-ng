import type { Metadata } from 'next';
import Link from 'next/link';
import { getDb } from '@/db/client';
import { catalogue, type CourseState } from '@/server/catalogue';
import { currentUser } from '@/server/session';

export const metadata: Metadata = { title: 'Kursus' };

const LABEL: Record<CourseState, string> = {
  baru: 'Belum dimulai',
  berjalan: 'Sedang berjalan',
  lulus: 'Lulus',
};
const CTA: Record<CourseState, string> = {
  baru: 'Lihat kursus',
  berjalan: 'Lanjutkan',
  lulus: 'Buka kembali',
};

export default async function CataloguePage() {
  const user = await currentUser();
  const groups = await catalogue(await getDb(), user?.id ?? null);
  return (
    <>
      <h1>Kursus</h1>
      <p className="muted">
        Kursus dikelompokkan per topik. Topik Retina akan bertambah, termasuk AMD dan DME.
      </p>
      {groups.length === 0 && <p className="notice info">Belum ada kursus yang diterbitkan.</p>}
      {groups.map((g) => (
        <section key={g.slug} className="topic" aria-labelledby={`t-${g.slug}`}>
          <h2 id={`t-${g.slug}`}>{g.title}</h2>
          <div className="courses">
            {g.courses.map((c) => (
              <article key={c.slug} className="card course">
                {user && <span className={`pill ${c.state}`}>{LABEL[c.state]}</span>}
                <h3>{c.title}</h3>
                {c.summary && <p className="muted small">{c.summary}</p>}
                <Link
                  className="btn"
                  href={c.state === 'baru' ? `/kursus/${c.slug}` : `/belajar/${c.slug}`}
                >
                  {CTA[c.state]}
                </Link>
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
