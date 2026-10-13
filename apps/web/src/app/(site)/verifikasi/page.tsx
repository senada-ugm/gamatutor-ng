import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { AccountError, verifyEmail } from '@/server/accounts';

export const metadata: Metadata = { title: 'Verifikasi email' };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  let error = 'Tautan verifikasi tidak lengkap.';
  if (token) {
    try {
      await verifyEmail(await getDb(), token);
      error = '';
    } catch (e) {
      if (!(e instanceof AccountError)) throw e;
      error = e.message;
    }
  }
  if (!error) redirect('/masuk?verified=1');
  return (
    <div className="narrow" style={{ margin: '0 auto' }}>
      <h1>Verifikasi email</h1>
      <p className="notice err">{error}</p>
      <p>
        Coba <Link href="/masuk">masuk</Link>; jika email belum terverifikasi, kami akan mengirim tautan baru.
      </p>
    </div>
  );
}
