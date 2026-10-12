import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildStandalone } from '../../tools/build-standalone.js';

const OUT = 'out/drive-retinopati';

beforeAll(async () => {
  await buildStandalone({ courseDir: 'content/drive-retinopati', outDir: OUT });
}, 120_000);

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

  it('ships the 3D atlas inside the package, so the embed page works offline', () => {
    const html = readFileSync(`${OUT}/index.html`, 'utf8');
    expect(html).toContain('assets/anatomi-mata/index.html?embed');
    const atlas = readFileSync(`${OUT}/assets/anatomi-mata/index.html`, 'utf8');
    for (const ref of atlas.match(/\.\/assets\/[^"]+/g) ?? []) {
      expect(() => readFileSync(`${OUT}/assets/anatomi-mata/${ref.slice(2)}`)).not.toThrow();
    }
  });
});
