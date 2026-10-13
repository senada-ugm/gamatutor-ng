import Link from 'next/link';
import { currentUser } from '@/server/session';

export default async function Home() {
  const user = await currentUser();
  return (
    <>
      <section className="hero">
        <h1>Pelatihan Skrining Retinopati Diabetika</h1>
        <p>
          Kursus daring untuk dokter layanan primer: diabetes mellitus, retinopati diabetika, skrining dan tatalaksana, lalu
          simulasi grading foto fundus. Bernarasi, interaktif, dan bersertifikat.
        </p>
        <div className="actions">
          {user ? (
            <Link className="btn" href="/kursus">
              Lanjutkan belajar
            </Link>
          ) : (
            <>
              <Link className="btn" href="/daftar">
                Daftar sebagai peserta
              </Link>
              <Link className="btn btn-ghost" href="/masuk">
                Masuk
              </Link>
            </>
          )}
        </div>
      </section>
      <div className="features">
        <div className="card">
          <h2>Belajar sesuai waktu Anda</h2>
          <p className="muted">Kemajuan tersimpan otomatis. Lanjutkan kapan saja dari perangkat mana pun.</p>
        </div>
        <div className="card">
          <h2>Simulasi grading</h2>
          <p className="muted">Nilai foto fundus pasien diabetes, lalu lihat setiap lesi yang seharusnya terlihat.</p>
        </div>
        <div className="card">
          <h2>Sertifikat atas nama Anda</h2>
          <p className="muted">Diterbitkan otomatis setelah lulus evaluasi, sesuai nama di akun, dan bisa diverifikasi.</p>
        </div>
      </div>
    </>
  );
}
