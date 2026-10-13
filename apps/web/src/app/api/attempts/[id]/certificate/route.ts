import { getDb } from '@/db/client';
import { CertificateError, issueCertificate } from '@/server/learning';
import { currentUser } from '@/server/session';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Silakan masuk dulu.' }, { status: 401 });
  const { id } = await params;
  try {
    const cert = await issueCertificate(await getDb(), user.id, id);
    return Response.json({ url: `/sertifikat/${cert.serial}` });
  } catch (e) {
    if (e instanceof CertificateError) return Response.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
