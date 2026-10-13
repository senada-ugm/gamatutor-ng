/**
 * Publishes a native course directory as a new immutable version.
 *
 *   pnpm web course:publish ../../content/drive-retinopati --topic retina \
 *     --topic-title Retina --summary "Skrining retinopati diabetika…"
 *
 * Uses DATABASE_URL (or the dev PGlite in .data/pglite) and GT_STORAGE_DIR.
 */
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { getDb } from '../src/db/client';
import { publishCourse } from '../src/server/catalogue';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    topic: { type: 'string', default: 'retina' },
    'topic-title': { type: 'string' },
    summary: { type: 'string' },
  },
});

const dir = positionals[0];
if (!dir) {
  console.error('usage: course:publish <course-dir> [--topic slug] [--topic-title Title] [--summary text]');
  process.exit(2);
}
const topicSlug = values.topic!;
const topicTitle = values['topic-title'] ?? topicSlug.charAt(0).toUpperCase() + topicSlug.slice(1);

const db = await getDb();
const { course, version, unchanged } = await publishCourse(db, {
  courseDir: resolve(dir),
  topicSlug,
  topicTitle,
  ...(values.summary !== undefined ? { summary: values.summary } : {}),
});
console.log(
  unchanged
    ? `${course.slug} unchanged; still v${version.version}`
    : `published ${course.slug} v${version.version} under topic "${topicTitle}"`,
);
process.exit(0);
