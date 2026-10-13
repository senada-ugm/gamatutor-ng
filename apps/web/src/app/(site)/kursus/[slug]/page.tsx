import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Course } from '@gamatutor/course-schema';
import { getDb } from '@/db/client';
import { courseBySlug } from '@/server/catalogue';
import { currentUser } from '@/server/session';
import { startCourseAction } from '../../actions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const found = await courseBySlug(await getDb(), (await params).slug);
  return { title: found?.course.title ?? 'Kursus' };
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await courseBySlug(await getDb(), slug);
  if (!found) notFound();
  const user = await currentUser();
  const manifest = found.latest.manifest as Course;
  const modules = manifest.modules.filter((m) => !m.completion && m.pages.length > 0);
  const quizCount = manifest.modules.flatMap((m) => m.pages).filter((p) => p.type === 'quiz').length;
  return (
    <div className="narrow" style={{ margin: '0 auto' }}>
      <p className="small">
        <Link href="/kursus">&larr; Semua kursus</Link>
      </p>
      <h1>{found.course.title}</h1>
      {found.course.summary && <p className="muted">{found.course.summary}</p>}
      <div className="card">
        <h2>Isi kursus</h2>
        <ol>
          {modules.map((m) => (
            <li key={m.id}>
              {m.label} <span className="muted small">({m.pages.length} halaman)</span>
            </li>
          ))}
        </ol>
        <p className="small muted">
          Evaluasi {quizCount} soal · batas kelulusan {Math.round(manifest.passingScore * 100)}% ·
          boleh diulang sampai Anda puas dengan nilainya.
        </p>
        {user ? (
          <form action={startCourseAction}>
            <input type="hidden" name="slug" value={slug} />
            <button className="btn" type="submit">
              Mulai kursus
            </button>
          </form>
        ) : (
          <div className="actions">
            <Link className="btn" href="/daftar">
              Daftar untuk mulai
            </Link>
            <Link className="btn btn-ghost" href={`/masuk?lanjut=/kursus/${slug}`}>
              Saya sudah punya akun
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
