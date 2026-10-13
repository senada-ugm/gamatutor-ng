import type { Metadata } from 'next';
import { ProfileForm } from '@/components/forms';
import { PROFESSIONS, PROVINCES } from '@/server/registration';
import { requireUser } from '@/server/session';
import { profileAction } from '../actions';

export const metadata: Metadata = { title: 'Profil' };

export default async function ProfilePage() {
  const user = await requireUser('/profil');
  const defaults = {
    fullName: user.fullName,
    birthDate: user.birthDate,
    phone: user.phone,
    profession: user.profession,
    institution: user.institution,
    province: user.province,
    city: user.city,
  };
  return (
    <div className="narrow" style={{ margin: '0 auto' }}>
      <h1>Profil</h1>
      <p className="muted">
        Email: <b>{user.email}</b>. Perubahan nama berlaku untuk sertifikat berikutnya; sertifikat yang sudah terbit tidak berubah.
      </p>
      <div className="card">
        <ProfileForm action={profileAction} professions={PROFESSIONS} provinces={PROVINCES} defaults={defaults} />
      </div>
    </div>
  );
}
