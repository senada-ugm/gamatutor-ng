import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as esbuild from 'esbuild';
import { parseCourse } from '../packages/course-schema/src/index.js';
import type { Course } from '../packages/course-schema/src/index.js';
import { scorm12Manifest } from './scorm12-manifest.js';

export interface BuildOptions {
  courseDir: string;
  outDir: string;
}

export interface BuildResult {
  html: string;
  manifest: string;
  outDir: string;
}

const PLAYER_ENTRY = 'packages/course-player/src/index.ts';
const PLAYER_CSS = 'packages/course-player/src/styles.css';

async function bundlePlayer(): Promise<string> {
  const result = await esbuild.build({
    entryPoints: [PLAYER_ENTRY],
    bundle: true,
    format: 'iife',
    globalName: 'GamaTutorPlayer',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    write: false,
  });
  const file = result.outputFiles?.[0];
  if (!file) throw new Error('build-standalone: esbuild produced no output');
  return file.text;
}

/**
 * The page skeleton, matching the markup the original course shipped with.
 * Only the brand mark and course title are substituted.
 */
function shell(course: Course, css: string, playerJs: string, courseJson: string): string {
  return `<!DOCTYPE html>
<html lang="${course.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${course.title}</title>
<style>
${css}
</style>
</head>
<body>

<div class="app">

  <div class="sidebar">
    <div class="sidebar-head">
      <div class="top-icons"><span>&laquo; Semua Modul</span><span>&times;</span></div>
      <div class="brand"><div class="brand-mark">${course.brand.mark}</div></div>
      <div class="course-title">${course.title}</div>
    </div>
    <ul class="steps" id="stepList"></ul>
  </div>

  <div class="main">
    <div class="content-card" id="contentCard"></div>
  </div>

</div>

<script id="course-data" type="application/json">${courseJson}</script>
<script>${playerJs}</script>
<script>
(function () {
  var course = JSON.parse(document.getElementById('course-data').textContent);
  var adapter = new GamaTutorPlayer.Scorm12Adapter(window);
  var player = GamaTutorPlayer.createPlayer({
    mount: document.querySelector('.app'),
    course: course,
    adapter: adapter
  });
  // init() performs its LMS calls synchronously, so the recorded call order
  // matches the original's synchronous scormInit().
  adapter.init();
  player.render();
  window.addEventListener('beforeunload', function () { adapter.terminate(); });
})();
</script>
</body>
</html>
`;
}

export async function buildStandalone(opts: BuildOptions): Promise<BuildResult> {
  const courseJsonPath = join(opts.courseDir, 'course.json');
  const raw = readFileSync(courseJsonPath, 'utf8');
  const course = parseCourse(JSON.parse(raw));

  const [playerJs, css] = [await bundlePlayer(), readFileSync(PLAYER_CSS, 'utf8')];
  const html = shell(course, css, playerJs, JSON.stringify(course));
  const manifest = scorm12Manifest(course);

  mkdirSync(opts.outDir, { recursive: true });
  writeFileSync(join(opts.outDir, 'index.html'), html, 'utf8');
  writeFileSync(join(opts.outDir, 'imsmanifest.xml'), manifest, 'utf8');

  const assetsSrc = join(opts.courseDir, 'assets');
  if (existsSync(assetsSrc)) {
    cpSync(assetsSrc, join(opts.outDir, 'assets'), { recursive: true });
  }

  return { html, manifest, outDir: opts.outDir };
}

const invokedDirectly = process.argv[1]?.replace(/\\/g, '/').endsWith('tools/build-standalone.ts');
if (invokedDirectly) {
  const courseDir = process.argv[2] ?? 'content/drive-retinopati';
  const outDir = process.argv[3] ?? `out/${courseDir.split(/[\\/]/).pop()}`;
  buildStandalone({ courseDir, outDir }).then((r) => {
    console.log(`built ${r.outDir} (${(r.html.length / 1024).toFixed(0)} kB index.html)`);
  });
}
