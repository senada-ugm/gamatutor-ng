import { describe, expect, it } from 'vitest';
import { parseCourse } from '../src/index.js';

const minimal = {
  schemaVersion: 1,
  id: 'demo',
  title: 'Demo',
  language: 'id-ID',
  brand: { name: 'Demo School', mark: 'D' },
  passingScore: 0.6,
  assessment: { mode: 'formative' },
  modules: [
    { id: 'm1', label: 'Modul 1', pages: [{ id: 'm1-p1', type: 'divider', title: 'BAB 1' }] },
  ],
};

describe('parseCourse', () => {
  it('accepts a minimal valid course', () => {
    expect(parseCourse(minimal).id).toBe('demo');
  });

  it('rejects a page with no id', () => {
    const bad = structuredClone(minimal);
    delete (bad.modules[0]!.pages[0] as Record<string, unknown>).id;
    expect(() => parseCourse(bad)).toThrow();
  });

  it('rejects an unknown page type', () => {
    const bad = structuredClone(minimal);
    (bad.modules[0]!.pages[0] as Record<string, unknown>).type = 'fundus';
    expect(() => parseCourse(bad)).toThrow();
  });

  it('accepts a completion module with no pages', () => {
    const ok = structuredClone(minimal);
    ok.modules.push({ id: 'selesai', label: 'Selesai', completion: true, pages: [] } as never);
    expect(parseCourse(ok).modules).toHaveLength(2);
  });

  it('accepts all three reveal step shapes', () => {
    const ok = structuredClone(minimal);
    ok.modules[0]!.pages.push({
      id: 'm1-p2',
      type: 'content',
      reveal_steps: [
        { texts: ['a', 'b'] },
        { image: 'assets/x.png', title: 't', body: 'b' },
        { video: { src: 'assets/v.mp4', poster: 'assets/v.jpg' } },
      ],
    } as never);
    expect(parseCourse(ok).modules[0]!.pages).toHaveLength(2);
  });
});
