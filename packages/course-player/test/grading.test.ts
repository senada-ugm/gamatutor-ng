import { describe, expect, it } from 'vitest';
import { arrowSvg, badgePosition } from '../src/pages/image-grading.js';
import { driveCourse, goTo, mount } from './helpers.js';

const course = driveCourse();

function choose(doc: Document, text: string): void {
  const row = [...doc.querySelectorAll<HTMLElement>('#optList .opt-row')].find((r) =>
    r.textContent!.includes(text),
  );
  row!.click();
}

describe('image grading feedback', () => {
  it('turns the chosen option and the feedback box red when the answer is wrong', () => {
    const m = mount(course);
    goTo(m, course, 'modul4-p3'); // correct: "Retinopati diabetika"
    expect(m.doc.querySelector('.page-instruction')).not.toBeNull();
    choose(m.doc, 'Tidak ada retinopati');
    const box = m.doc.querySelector('.reasoning-box')!;
    expect(box.classList.contains('is-wrong')).toBe(true);
    expect(box.textContent).toContain('Kurang tepat');
    expect(box.textContent).toContain('Jawaban yang benar: Retinopati diabetika');
    expect(m.doc.querySelector('.opt-row.wrong')!.textContent).toContain('Tidak ada retinopati');
    expect(m.doc.querySelector('.opt-row.correct')!.textContent).toContain('Retinopati diabetika');
  });

  it('keeps the box green when the answer is right', () => {
    const m = mount(course);
    goTo(m, course, 'modul4-p3');
    choose(m.doc, 'Retinopati diabetika');
    const box = m.doc.querySelector('.reasoning-box')!;
    expect(box.classList.contains('is-wrong')).toBe(false);
    expect(box.textContent).toContain('Benar');
    expect(m.doc.querySelector('.opt-row.wrong')).toBeNull();
  });

  it('marks lesions with an arrow and an offset badge, not a circle on the lesion', () => {
    const m = mount(course);
    goTo(m, course, 'modul4-p3');
    choose(m.doc, 'Retinopati diabetika');
    const lesions = course.modules[4]!.pages[2]!;
    if (lesions.type !== 'image-grading') throw new Error('fixture moved');
    expect(m.doc.querySelectorAll('.lesion-arrows line')).toHaveLength(lesions.lesions.length);
    const badge = m.doc.querySelector<HTMLElement>('#fundusStage .pin')!;
    const l = lesions.lesions[0]!;
    expect(badge.style.left).not.toBe(`${l.x}%`);
    badge.click();
    expect(m.doc.querySelector('.pin-label')!.textContent).toBe(l.label);
    expect(m.doc.querySelector<HTMLElement>('.pin-label')!.style.left).toBe(
      m.doc.querySelector<HTMLElement>('#fundusStage .pin')!.style.left,
    );
  });
});

describe('badge placement', () => {
  it('pushes the badge 16% outward from the image centre', () => {
    const b = badgePosition({ x: 50, y: 30, label: '' });
    expect(b.x).toBeCloseTo(50);
    expect(b.y).toBeCloseTo(14);
  });

  it('honours an explicit offset and keeps the badge inside the image', () => {
    expect(badgePosition({ x: 20, y: 50, label: '', dx: -20, dy: 5 })).toEqual({ x: 6, y: 55 });
  });

  it('picks a direction even for a lesion at the centre', () => {
    const b = badgePosition({ x: 50, y: 50, label: '' });
    expect(b.x).toBeLessThan(50);
    expect(b.y).toBeLessThan(50);
  });

  it('stops the arrow short of the lesion', () => {
    const svg = arrowSvg({ x: 50, y: 30, label: '' });
    const tip = svg.match(/points="([\d.]+),([\d.]+)/)!;
    expect(Number(tip[2])).toBeLessThan(30);
    expect(30 - Number(tip[2])).toBeCloseTo(2.2, 1);
  });
});

describe('review fixes', () => {
  it('turns a badge inward when the edge would clamp it onto its lesion', () => {
    const l = { x: 92, y: 50, label: '' };
    const b = badgePosition(l);
    expect(Math.hypot(b.x - l.x, b.y - l.y)).toBeGreaterThanOrEqual(8);
    expect(b.x).toBeLessThan(l.x);
  });

  it('ignores a zero offset that would put the badge on the lesion', () => {
    const l = { x: 30, y: 30, label: '', dx: 0, dy: 0 };
    const b = badgePosition(l);
    expect(Math.hypot(b.x - l.x, b.y - l.y)).toBeGreaterThanOrEqual(8);
  });

  it('matches an option whose text contains a double quote', () => {
    const quoted = structuredClone(course);
    const page = quoted.modules[4]!.pages[2]!;
    if (page.type !== 'image-grading') throw new Error('fixture moved');
    page.options = ['Tidak ada "RD"', 'Ada "RD"'];
    page.correct = 'Ada "RD"';
    const m = mount(quoted);
    goTo(m, quoted, page.id);
    choose(m.doc, 'Ada "RD"');
    expect(m.doc.querySelector('.reasoning-box')!.classList.contains('is-wrong')).toBe(false);
  });
});

describe('quiz feedback', () => {
  it('turns the feedback box red for a wrong answer', () => {
    const m = mount(course);
    goTo(m, course, 'evaluasi-p2');
    const page = course.modules[5]!.pages[1]!;
    if (page.type !== 'quiz') throw new Error('fixture moved');
    const wrong = page.options.find((o) => o.letter !== page.correct)!;
    m.doc.querySelector<HTMLElement>(`.opt-row[data-letter="${wrong.letter}"]`)!.click();
    m.doc.getElementById('quizSubmitBtn')!.click();
    expect(m.doc.querySelector('.reasoning-box')!.classList.contains('is-wrong')).toBe(true);
  });
});
