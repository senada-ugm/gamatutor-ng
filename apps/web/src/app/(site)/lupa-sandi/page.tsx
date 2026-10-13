import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotForm } from '@/components/forms';
import { forgotAction } from '../actions';

export const metadata: Metadata = { title: 'Lupa kata sandi' };

export default function ForgotPage() {
  return (
    <div className="narrow" style={{ margin: '0 auto' }}>
      <h1>Lupa kata sandi</h1>
      <p className="muted">Masukkan email akun Anda. Kami akan mengirim tautan untuk membuat kata sandi baru.</p>
      <div className="card">
        <ForgotForm action={forgotAction} />
      </div>
      <p className="small">
        <Link href="/masuk">&larr; Kembali ke halaman masuk</Link>
      </p>
    </div>
  );
}
