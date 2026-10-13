import { createReadStream, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { courseVersions } from '@/db/schema';
import { canReadVersion, storageRoot } from '@/server/catalogue';
import { currentUser } from '@/server/session';

const TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.vtt': 'text/vtt',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};

/**
 * Course assets, streamed only to learners enrolled in that version. Supports
 * byte ranges, which video and audio seeking needs.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ versionId: string; path: string[] }> },
) {
  const user = await currentUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const { versionId, path } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(versionId)) return new Response('Not found', { status: 404 });
  const db = await getDb();
  if (user.role !== 'admin' && !(await canReadVersion(db, user.id, versionId))) {
    return new Response('Forbidden', { status: 403 });
  }
  const version = await db.query.courseVersions.findFirst({ where: eq(courseVersions.id, versionId) });
  if (!version) return new Response('Not found', { status: 404 });

  const root = resolve(storageRoot(), version.storageDir);
  // Next has already decoded the segments once; decoding again would turn a
  // literal "%" into an error and "%2e%2e" into "..".
  const file = resolve(join(root, ...path));
  if (!file.startsWith(root + sep)) return new Response('Not found', { status: 404 });
  let size: number;
  try {
    const st = statSync(file);
    if (!st.isFile()) throw new Error('not a file');
    size = st.size;
  } catch {
    return new Response('Not found', { status: 404 });
  }

  const headers: Record<string, string> = {
    'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'accept-ranges': 'bytes',
    // Versions are immutable, so the browser may keep these.
    'cache-control': 'private, max-age=604800, immutable',
    'x-content-type-options': 'nosniff',
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '');
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end) {
      return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
    }
    const body = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(body, {
      status: 206,
      headers: { ...headers, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1) },
    });
  }
  const body = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(body, { headers: { ...headers, 'content-length': String(size) } });
}
