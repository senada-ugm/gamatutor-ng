import { getDb } from '@/db/client';
import { IncomingBatch, ingest } from '@/server/learning';
import { currentUser } from '@/server/session';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 });
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }
  const parsed = IncomingBatch.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'invalid batch' }, { status: 400 });
  try {
    const { accepted } = await ingest(await getDb(), user.id, id, parsed.data.events);
    return Response.json({ accepted });
  } catch {
    return Response.json({ error: 'attempt not found' }, { status: 404 });
  }
}
