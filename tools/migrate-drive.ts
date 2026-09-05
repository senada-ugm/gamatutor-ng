import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { migrateCourse } from '../packages/course-schema/src/migrate.js';

const html = readFileSync('fixtures/legacy/index.html', 'utf8');
const m = html.match(/<script id="course-data" type="application\/json">([\s\S]*?)<\/script>/);
if (!m?.[1]) throw new Error('course-data block not found');

const course = migrateCourse(JSON.parse(m[1]), {
  id: 'drive-retinopati',
  title: 'DRIVE — Skrining Retinopati Diabetika untuk Dokter Layanan Primer',
  brand: { name: 'DRIVE School', mark: '👁' },
  passingScore: 0.6,
});

mkdirSync('content/drive-retinopati', { recursive: true });
writeFileSync(
  'content/drive-retinopati/course.json',
  JSON.stringify(course, null, 2) + '\n',
  'utf8',
);
console.log(`wrote ${course.modules.length} modules`);
