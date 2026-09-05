import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { migrateCourse } from '../src/migrate.js';

const META = {
  id: 'drive-retinopati',
  title: 'DRIVE — Skrining Retinopati Diabetika untuk Dokter Layanan Primer',
  brand: { name: 'DRIVE School', mark: '👁' },
  passingScore: 0.6,
};

/** Pull the raw JSON straight out of the frozen fixture. */
function legacyRaw(): unknown {
  const html = readFileSync('fixtures/legacy/index.html', 'utf8');
  const m = html.match(/<script id="course-data" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m?.[1]) throw new Error('course-data block not found in the frozen fixture');
  return JSON.parse(m[1]);
}

describe('migrateCourse', () => {
  it('produces a schema-valid v1 course', () => {
    const c = migrateCourse(legacyRaw(), META);
    expect(c.schemaVersion).toBe(1);
    expect(c.modules).toHaveLength(7);
  });

  it('assigns deterministic module and page ids', () => {
    const c = migrateCourse(legacyRaw(), META);
    expect(c.modules[0]!.id).toBe('pengantar');
    expect(c.modules[0]!.pages[0]!.id).toBe('pengantar-p1');
    expect(c.modules[1]!.pages[2]!.id).toBe('modul1-p3');
  });

  it('renames fundus to image-grading', () => {
    const c = migrateCourse(legacyRaw(), META);
    const types = c.modules.flatMap((m) => m.pages.map((p) => p.type));
    expect(types).toContain('image-grading');
    expect(types).not.toContain('fundus');
  });

  it('reshapes the bare video reveal step without changing page count', () => {
    const raw = legacyRaw() as { modules: { key: string; pages: unknown[] }[] };
    const before = raw.modules.find((m) => m.key === 'modul3')!.pages.length;
    const c = migrateCourse(raw, META);
    const modul3 = c.modules.find((m) => m.id === 'modul3')!;
    expect(modul3.pages).toHaveLength(before);
    const page = modul3.pages[1]!;
    if (page.type !== 'content' || !page.reveal_steps) throw new Error('expected reveal steps');
    expect(page.reveal_steps.at(-1)).toEqual({
      video: { src: 'assets/visus.mp4', poster: 'assets/visus_poster.jpg' },
    });
  });

  it('flags the completion module', () => {
    const c = migrateCourse(legacyRaw(), META);
    expect(c.modules.at(-1)).toMatchObject({ id: 'selesai', completion: true, pages: [] });
  });

  it('marks every quiz page graded', () => {
    const c = migrateCourse(legacyRaw(), META);
    const quizzes = c.modules.flatMap((m) => m.pages).filter((p) => p.type === 'quiz');
    expect(quizzes).toHaveLength(5);
    expect(quizzes.every((q) => q.type === 'quiz' && q.graded)).toBe(true);
  });

  it('is idempotent — migrating twice gives the same course', () => {
    const once = migrateCourse(legacyRaw(), META);
    expect(migrateCourse(once, META)).toEqual(once);
  });
});
