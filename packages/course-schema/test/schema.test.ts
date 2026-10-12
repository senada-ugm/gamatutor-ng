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

describe('feedback-A additions', () => {
  const withPages = (pages: unknown[], extra: Record<string, unknown> = {}) => ({
    ...structuredClone(minimal),
    ...extra,
    modules: [{ id: 'm1', label: 'Modul 1', pages }],
  });

  it('accepts narration, audio, cues and reveal columns', () => {
    const c = parseCourse(
      withPages([
        {
          id: 'c',
          type: 'content',
          audio: 'assets/c.mp3',
          revealColumns: 2,
          transcript: 'Lead-in.',
          reveal_steps: [{ texts: ['a. Satu'], narration: 'Satu.', cue: 2.5 }],
        },
      ]),
    );
    const p = c.modules[0]!.pages[0]!;
    expect(p.type === 'content' && p.reveal_steps?.[0]).toMatchObject({
      narration: 'Satu.',
      cue: 2.5,
    });
  });

  it('rejects three reveal columns', () => {
    expect(() =>
      parseCourse(withPages([{ id: 'c', type: 'content', revealColumns: 3 }])),
    ).toThrow();
  });

  it('accepts ordered hotspots, lesion offsets, grading copy, quiz tag, completion copy', () => {
    const c = parseCourse(
      withPages(
        [
          { id: 'h', type: 'hotspot', title: 'H', image: 'i.png', ordered: true, points: [] },
          {
            id: 'g',
            type: 'image-grading',
            title: 'Simulasi',
            instruction: 'Pilih diagnosis.',
            image: 'f.png',
            options: ['A', 'B'],
            correct: 'A',
            reasoning: 'r',
            lesions: [{ x: 10, y: 10, label: 'HE', dx: -12, dy: 4 }],
          },
          {
            id: 'q',
            type: 'quiz',
            tag: 'Post-test',
            question: 'Q',
            options: [
              { letter: 'A', text: 'a' },
              { letter: 'B', text: 'b' },
            ],
            correct: 'A',
            explanation: 'e',
          },
          { id: 'k', type: 'cards', audio: 'k.mp3', cards: [] },
        ],
        { completion: { body: 'Selesai.', certificateText: 'telah menyelesaikan X' } },
      ),
    );
    expect(c.completion?.certificateText).toBe('telah menyelesaikan X');
  });
});
