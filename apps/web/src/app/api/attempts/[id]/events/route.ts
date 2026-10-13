import { getDb } from '@/db/client';
import { AttemptNotFound, IncomingBatch, ingest } from '@/server/learning';
import { allow } from '@/server/ratelimit';
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
  // A real learner sends a few hundred events an hour; this bounds abuse.
  if (!allow(`events:${user.id}`, 3_000, 3_600_000)) {
    return Response.json({ error: 'too many events' }, { status: 429 });
  }
  try {
    const { accepted } = await ingest(await getDb(), user.id, id, parsed.data.events);
    return Response.json({ accepted });
  } catch (e) {
    if (e instanceof AttemptNotFound) return Response.json({ error: 'attempt not found' }, { status: 404 });
    throw e;
  }
}
