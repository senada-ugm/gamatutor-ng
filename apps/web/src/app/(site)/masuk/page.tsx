import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/forms';
import { currentUser, safeNext } from '@/server/session';
import { loginAction } from '../actions';

export const metadata: Metadata = { title: 'Masuk' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ lanjut?: string; verified?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.lanjut);
  if (await currentUser()) redirect(next);
  return (
    <div className="narrow" style={{ margin: '0 auto' }}>
      <h1>Masuk</h1>
      {sp.verified && <p className="notice ok">Email terverifikasi. Silakan masuk.</p>}
      <div className="card">
        <LoginForm action={loginAction} next={next} />
      </div>
    </div>
  );
}
