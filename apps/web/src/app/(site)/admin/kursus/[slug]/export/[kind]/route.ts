import { getDb } from '@/db/client';
import { courseReport, eventsCsv, learnersCsv } from '@/server/reports';
import { currentUser } from '@/server/session';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; kind: string }> },
) {
  const user = await currentUser();
  if (user?.role !== 'admin') return new Response('Forbidden', { status: 403 });
  const { slug, kind } = await params;
  const db = await getDb();
  let csv: string | null = null;
  if (kind === 'peserta') {
    const report = await courseReport(db, slug);
    csv = report ? learnersCsv(report.learners) : null;
  } else if (kind === 'events') {
    csv = await eventsCsv(db, slug);
  }
  if (csv === null) return new Response('Not found', { status: 404 });
  const stamp = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${slug}-${kind}-${stamp}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
