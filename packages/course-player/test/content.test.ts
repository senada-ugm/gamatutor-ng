import { describe, expect, it } from 'vitest';
import { parseCourse, type Course } from '@gamatutor/course-schema';
import { transcriptHtml } from '../src/chrome/panels.js';
import { goTo, mount } from './helpers.js';

const texts = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ texts: [`${'abcdefghij'[i]}. Butir ${i + 1}`] }));

const course: Course = parseCourse({
  schemaVersion: 1,
  id: 't',
  title: 'T',
  brand: { name: 'B', mark: 'B' },
  passingScore: 0.6,
  assessment: { mode: 'formative' },
  modules: [
    {
      id: 'm',
      label: 'M',
      pages: [
        { id: 'ten', type: 'content', title: 'Sepuluh', reveal_steps: texts(10) },
        { id: 'three', type: 'content', title: 'Tiga', reveal_steps: texts(3) },
        {
          id: 'forced',
          type: 'content',
          title: 'Satu kolom',
          revealColumns: 1,
          reveal_steps: texts(6),
        },
        {
          id: 'hs',
          type: 'hotspot',
          title: 'Alur',
          intro: 'Klik nomor secara berurutan 1–3.',
          image: 'x.png',
          ordered: true,
          points: [
            { x: 10, y: 10, label: 'A', body: 'a' },
            { x: 20, y: 20, label: 'B', body: 'b' },
            { x: 30, y: 30, label: 'C', body: 'c' },
          ],
        },
      ],
    },
    { id: 'end', label: 'Selesai', completion: true, pages: [] },
  ],
});

describe('reveal lists', () => {
  it('draws every step from the start and hides the ones not reached', () => {
    const m = mount(course);
    goTo(m, course, 'ten');
    expect(m.doc.querySelectorAll('.anim-step')).toHaveLength(10);
    expect(m.doc.querySelectorAll('.anim-step.anim-pending')).toHaveLength(9);
  });

  it('puts four or more list items in two column-major columns', () => {
    const m = mount(course);
    goTo(m, course, 'ten');
    const stack = m.doc.querySelector('.anim-stack')!;
    expect(stack.classList.contains('two-col')).toBe(true);
    expect(stack.getAttribute('style')).toContain('--rows:5');
  });

  it('keeps short lists and explicit single-column pages in one column', () => {
    const m = mount(course);
    goTo(m, course, 'three');
    expect(m.doc.querySelector('.anim-stack.two-col')).toBeNull();
    goTo(m, course, 'forced');
    expect(m.doc.querySelector('.anim-stack.two-col')).toBeNull();
  });

  it('tells the learner the items come on their own and → speeds them up', () => {
    const m = mount(course);
    goTo(m, course, 'ten');
    expect(m.doc.querySelector('.anim-hint')!.textContent).toMatch(
      /muncul .*\(1\/10\).*mempercepat/,
    );
  });
});

describe('transcript panel', () => {
  it('shows the lead-in as paragraphs and bullets, and step narration as a list', () => {
    const html = transcriptHtml({
      id: 'p',
      type: 'content',
      transcript: 'Paragraf satu.\nParagraf dua.\n• Butir',
      reveal_steps: [{ texts: ['a. X'], narration: 'Pertama X.' }],
    });
    expect(html).toBe(
      '<p>Paragraf satu.</p><p>Paragraf dua.</p><ul><li>Butir</li></ul><ul><li>Pertama X.</li></ul>',
    );
  });

  it('lists hotspot points in order', () => {
    const page = course.modules[0]!.pages[3]!;
    expect(transcriptHtml(page)).toContain('<ol><li><b>A.</b> a</li>');
  });

  it('opens from the footer with the formatted text', () => {
    const m = mount(course);
    goTo(m, course, 'hs');
    (m.doc.querySelector('.footer-links span') as HTMLElement).click();
    expect(m.doc.querySelector('.gt-panel-body ol')).not.toBeNull();
  });
});

describe('ordered hotspot', () => {
  it('states the instruction and highlights the next number to click', () => {
    const m = mount(course);
    goTo(m, course, 'hs');
    expect(m.doc.querySelector('.page-instruction')!.textContent).toContain('berurutan');
    const pins = () => [...m.doc.querySelectorAll<HTMLElement>('.hotspot-pin')];
    expect(pins()[0]!.classList.contains('next')).toBe(true);
    pins()[0]!.click();
    expect(pins()[0]!.classList.contains('next')).toBe(false);
    expect(pins()[1]!.classList.contains('next')).toBe(true);
    expect(m.doc.querySelector('.hotspot-next')!.textContent).toContain('nomor 2');
  });
});
