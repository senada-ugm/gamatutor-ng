import type { Metadata } from 'next';
import Link from 'next/link';
import { currentUser } from '@/server/session';
import { logoutAction } from './actions';
import './site.css';

export const metadata: Metadata = {
  title: { default: 'DRIVE School · GamaTutor', template: '%s · DRIVE School' },
  description: 'Pelatihan daring skrining retinopati diabetika untuk dokter layanan primer.',
};

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="id">
      <body>
        <header className="topbar">
          <div className="topbar-in">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden="true">
                👁
              </span>
              DRIVE School
            </Link>
            <nav className="topnav" aria-label="Navigasi utama">
              <Link href="/kursus">Kursus</Link>
              {user ? (
                <>
                  {user.role === 'admin' && <Link href="/admin">Admin</Link>}
                  <Link href="/profil">Profil</Link>
                  <span className="whoami">{user.fullName}</span>
                  <form action={logoutAction}>
                    <button className="linkbtn" type="submit">
                      Keluar
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/masuk">Masuk</Link>
                  <Link href="/daftar">Daftar</Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer>
          DRIVE School · Pelatihan Skrining Retinopati Diabetika · Diselenggarakan di platform GamaTutor
        </footer>
      </body>
    </html>
  );
}
