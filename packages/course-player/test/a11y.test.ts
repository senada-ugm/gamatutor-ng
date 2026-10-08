import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { parseCourse } from '@gamatutor/course-schema';
import { createPlayer } from '../src/index.js';

const course = parseCourse(
  JSON.parse(readFileSync('content/drive-retinopati/course.json', 'utf8')),
);

function mountAt(moduleId: string, pageIdx: number): Document {
  const dom = new JSDOM(
    `<div class="app"><div class="sidebar"><ul id="stepList"></ul></div>
     <div class="main"><div id="contentCard"></div></div></div>`,
  );
  const player = createPlayer({
    mount: dom.window.document.querySelector('.app')!,
    course,
    random: () => 0.5,
  });
  player.state.moduleIdx = course.modules.findIndex((m) => m.id === moduleId);
  player.state.pageIdx = pageIdx;
  player.render();
  return dom.window.document;
}

function pageIndexOf(moduleId: string, type: string): number {
  const m = course.modules.find((x) => x.id === moduleId)!;
  const i = m.pages.findIndex((p) => p.type === type);
  if (i < 0) throw new Error(`no ${type} page in ${moduleId}`);
  return i;
}

describe('keyboard access', () => {
  it('makes every hotspot point focusable and labelled', () => {
    const doc = mountAt('modul2', pageIndexOf('modul2', 'hotspot'));
    const points = doc.querySelectorAll('#hotspotStage .hotspot-pin');
    expect(points.length).toBeGreaterThan(0);
    points.forEach((p) => {
      expect(p.getAttribute('tabindex')).toBe('0');
      expect(p.getAttribute('role')).toBe('button');
      expect(p.getAttribute('aria-label')).toBeTruthy();
    });
  });

  it('makes every match chip and drop zone focusable', () => {
    const doc = mountAt('modul2', pageIndexOf('modul2', 'match'));
    const chips = doc.querySelectorAll('#matchLeft .match-chip');
    const zones = doc.querySelectorAll('#matchRight .match-zone');
    expect(chips.length).toBeGreaterThan(0);
    expect(zones.length).toBeGreaterThan(0);
    chips.forEach((c) => expect(c.getAttribute('tabindex')).toBe('0'));
    zones.forEach((z) => expect(z.getAttribute('role')).toBe('button'));
  });

  it('makes the footer links operable from the keyboard', () => {
    const doc = mountAt('modul2', pageIndexOf('modul2', 'hotspot'));
    const links = doc.querySelectorAll('.footer-links span');
    expect(links).toHaveLength(3);
    links.forEach((l) => {
      expect(l.getAttribute('role')).toBe('button');
      expect(l.getAttribute('tabindex')).toBe('0');
    });
    const ev = new (doc.defaultView as Window & typeof globalThis).KeyboardEvent('keydown', {
      key: 'Enter',
    });
    links[1]!.dispatchEvent(ev);
    expect(doc.getElementById('gtPanel')!.querySelector('h2')!.textContent).toBe('Bantuan');
  });

  it('opens a hotspot point with the keyboard', () => {
    const doc = mountAt('modul2', pageIndexOf('modul2', 'hotspot'));
    const pin = doc.querySelector<HTMLElement>('#hotspotStage .hotspot-pin[data-i="0"]')!;
    const ev = new (doc.defaultView as Window & typeof globalThis).KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
    });
    pin.dispatchEvent(ev);
    expect(doc.querySelector('#hotspotDetail')?.innerHTML).not.toContain('placeholder');
  });
});

describe('embed page', () => {
  it('frames the 3D atlas with a title and keeps the footer arrows', () => {
    const doc = mountAt('modul2', pageIndexOf('modul2', 'embed'));
    const frame = doc.querySelector('.embed-frame iframe')!;
    expect(frame.getAttribute('src')).toBe('assets/anatomi-mata/index.html?embed');
    expect(frame.getAttribute('title')).toBe('Anatomi mata dalam 3D');
    expect(doc.querySelector('.embed-foot a')!.getAttribute('href')).toBe(
      'assets/anatomi-mata/index.html',
    );
    expect(doc.getElementById('nextBtn')).not.toBeNull();
  });
});

describe('footer links', () => {
  it('open a transcript panel outside the card, and Escape closes it', () => {
    const doc = mountAt('modul1', 1);
    const card = doc.getElementById('contentCard')!.innerHTML;
    const [transcript] = Array.from(doc.querySelectorAll<HTMLElement>('.footer-links span'));
    expect(transcript!.getAttribute('role')).toBe('button');
    transcript!.click();
    const panel = doc.getElementById('gtPanel')!;
    expect(panel.querySelector('h2')!.textContent).toBe('Transkrip');
    expect(panel.textContent).toContain('Diabetes mellitus merupakan sekelompok penyakit metabolik');
    expect(doc.getElementById('contentCard')!.innerHTML).toBe(card);
    doc.dispatchEvent(new doc.defaultView!.KeyboardEvent('keydown', { key: 'Escape' }));
    expect(doc.getElementById('gtPanel')).toBeNull();
  });

  it('say so when a page has no narration', () => {
    const doc = mountAt('modul4', 1);
    doc.querySelector<HTMLElement>('.footer-links span')!.click();
    expect(doc.getElementById('gtPanel')!.textContent).toContain('tidak memiliki narasi');
  });
});
