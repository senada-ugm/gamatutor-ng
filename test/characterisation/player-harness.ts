import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { parseCourse } from '@gamatutor/course-schema';
import { createPlayer, Scorm12Adapter } from '@gamatutor/course-player';
import { installDeterminism, type Harness, type ScormCall } from './harness.js';
import { legacyEquivalent } from './legacy-equivalent.js';

const SHELL = `<!doctype html><html><body>
<div class="app">
  <div class="sidebar"><ul class="steps" id="stepList"></ul></div>
  <div class="main"><div class="content-card" id="contentCard"></div></div>
</div>
</body></html>`;

/** Mount the extracted player over the same two hooks the legacy file uses. */
export async function loadPlayer(opts: { scorm?: boolean } = {}): Promise<Harness> {
  const scorm: ScormCall[] = [];
  const dom = new JSDOM(SHELL, {
    runScripts: 'dangerously',
    beforeParse(window) {
      installDeterminism(window as unknown as Window & typeof globalThis, scorm);
    },
  });
  const window = dom.window as unknown as Window & typeof globalThis;
  const course = legacyEquivalent(
    parseCourse(JSON.parse(readFileSync('content/drive-retinopati/course.json', 'utf8'))),
  );
  const adapter = opts.scorm ? new Scorm12Adapter(window) : undefined;
  if (adapter) await adapter.init();
  const player = createPlayer({
    mount: window.document.querySelector('.app')!,
    course,
    adapter,
    random: () => window.Math.random(),
  });
  player.render();
  return { window, document: window.document, scorm };
}
