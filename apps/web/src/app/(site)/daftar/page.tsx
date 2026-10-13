import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { RegisterForm } from '@/components/forms';
import { PROFESSIONS, PROVINCES } from '@/server/registration';
import { currentUser } from '@/server/session';
import { registerAction } from '../actions';

export const metadata: Metadata = { title: 'Daftar' };

export default async function RegisterPage() {
  if (await currentUser()) redirect('/kursus');
  return (
    <div className="narrow" style={{ margin: '0 auto' }}>
      <h1>Daftar sebagai peserta</h1>
      <p className="muted">
        Lengkapi data berikut. Nama lengkap akan tercetak pada sertifikat, jadi pastikan penulisan dan gelarnya benar.
      </p>
      <div className="card">
        <RegisterForm action={registerAction} professions={PROFESSIONS} provinces={PROVINCES} />
      </div>
    </div>
  );
}
