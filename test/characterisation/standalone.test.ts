import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildStandalone } from '../../tools/build-standalone.js';
import {
  installDeterminism,
  loadLegacy,
  runWalkthrough,
  type Harness,
  type ScormCall,
} from './harness.js';
import { fullWalkthrough } from './walkthroughs.js';

/** Same sanctioned a11y-attribute allowance as parity.test.ts. */
const A11Y_ATTRS = /\s(tabindex|role|aria-[a-z-]+)="[^"]*"/g;
const strip = (html: string) => html.replace(A11Y_ATTRS, '');

const OUT = 'out/drive-retinopati';

beforeAll(async () => {
  await buildStandalone({ courseDir: 'content/drive-retinopati', outDir: OUT });
}, 120_000);

function loadBuilt(): Harness {
  const html = readFileSync(`${OUT}/index.html`, 'utf8');
  const scorm: ScormCall[] = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    beforeParse(window) {
      installDeterminism(window as unknown as Window & typeof globalThis, scorm);
    },
  });
  const window = dom.window as unknown as Window & typeof globalThis;
  return { window, document: window.document, scorm };
}

describe('standalone build', () => {
  it('emits a single-SCO manifest naming the course', () => {
    const xml = readFileSync(`${OUT}/imsmanifest.xml`, 'utf8');
    expect(xml).toContain('adlcp:scormtype="sco"');
    expect(xml).toContain('href="index.html"');
    expect(xml).toContain('DRIVE');
  });

  it('copies the course assets beside the page', () => {
    expect(() => readFileSync(`${OUT}/assets/visus.mp4`)).not.toThrow();
    expect(() => readFileSync(`${OUT}/assets/hero-illustration.svg`)).not.toThrow();
  });

  it('walks the whole course identically to the frozen original', async () => {
    const legacy = runWalkthrough(await loadLegacy(), fullWalkthrough);
    const built = runWalkthrough(loadBuilt(), fullWalkthrough);
    expect(built).toHaveLength(legacy.length);
    legacy.forEach((snap, i) => {
      expect({ at: snap.label, card: strip(built[i]!.card) }).toEqual({
        at: snap.label,
        card: strip(snap.card),
      });
    });
  });

  it('makes the same SCORM calls as the frozen original', async () => {
    const legacy = await loadLegacy();
    runWalkthrough(legacy, fullWalkthrough);
    const built = loadBuilt();
    runWalkthrough(built, fullWalkthrough);
    expect(built.scorm).toEqual(legacy.scorm);
  });
});
