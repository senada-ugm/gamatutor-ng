import type { Metadata } from 'next';
import Link from 'next/link';
import { ResetForm } from '@/components/forms';
import { resetAction } from '../actions';

export const metadata: Metadata = { title: 'Atur ulang kata sandi' };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="narrow" style={{ margin: '0 auto' }}>
      <h1>Atur ulang kata sandi</h1>
      {token ? (
        <div className="card">
          <ResetForm action={resetAction} token={token} />
        </div>
      ) : (
        <p className="notice err">
          Tautan tidak lengkap. <Link href="/lupa-sandi">Minta tautan baru</Link>.
        </p>
      )}
    </div>
  );
}
