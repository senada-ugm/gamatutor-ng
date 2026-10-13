import { getDb } from '@/db/client';
import { saveResumeState } from '@/server/learning';
import { currentUser } from '@/server/session';

/**
 * POST, not PUT, so navigator.sendBeacon can deliver it as the tab closes.
 * Body: `{ seq, state }`; a save older than the stored one is ignored.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 });
  const { id } = await params;
  const text = await req.text();
  if (text.length > 200_000) return Response.json({ error: 'too large' }, { status: 413 });
  let body: { seq?: unknown; state?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }
  const { seq, state } = body ?? {};
  if (typeof seq !== 'number' || !Number.isSafeInteger(seq) || seq <= 0) {
    return Response.json({ error: 'invalid seq' }, { status: 400 });
  }
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    return Response.json({ error: 'invalid state' }, { status: 400 });
  }
  try {
    const stored = await saveResumeState(await getDb(), user.id, id, state, seq);
    return Response.json({ ok: true, stored });
  } catch {
    return Response.json({ error: 'attempt not found' }, { status: 404 });
  }
}
