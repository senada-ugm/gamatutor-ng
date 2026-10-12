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

  it('ships no 3D atlas: the course uses the 2D anatomy only', () => {
    const html = readFileSync(`${OUT}/index.html`, 'utf8');
    expect(html).not.toContain('anatomi-mata');
  });
});
