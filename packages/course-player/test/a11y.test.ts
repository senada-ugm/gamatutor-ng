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

  it('hides the decorative footer links from assistive tech', () => {
    const doc = mountAt('modul2', pageIndexOf('modul2', 'hotspot'));
    expect(doc.querySelector('.footer-links')?.getAttribute('aria-hidden')).toBe('true');
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
