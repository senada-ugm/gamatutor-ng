import { Link } from "@tanstack/react-router"

/**
 * Public site footer matching GamaTutor's institutional colophon:
 * "DRIVE School · Pelatihan Skrining Retinopati Diabetika · Diselenggarakan di platform GamaTutor"
 * "SENADA UGM · Disajikan oleh GamaTutor · Juga tersedia sebagai paket SCORM 1.2 untuk LMS lain."
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-[#d5e1ea] bg-[#fbfdfe] py-8 text-xs text-[#6b8196] dark:border-slate-800 dark:bg-background dark:text-slate-400">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 md:px-8">
        <div className="space-y-1 text-center sm:text-left">
          <p className="leading-relaxed">
            <span className="font-bold text-[#0f2a44] dark:text-white">DRIVE School</span> · Pelatihan Skrining
            Retinopati Diabetika · Diselenggarakan di platform GamaTutor FKKMK UGM
          </p>
          <p className="text-[11px] text-[#6b8196] dark:text-slate-500">
            SENADA UGM · Disajikan oleh GamaTutor · Juga tersedia sebagai paket SCORM 1.2 untuk LMS lain.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold">
          <Link to="/courses" className="text-[#46607a] hover:text-[#137a77] hover:underline dark:text-slate-300">
            Kursus
          </Link>
          <Link
            to="/certificates/verify"
            className="text-[#46607a] hover:text-[#137a77] hover:underline dark:text-slate-300"
          >
            Verifikasi Sertifikat
          </Link>
          <Link to="/login" className="text-[#46607a] hover:text-[#137a77] hover:underline dark:text-slate-300">
            Masuk
          </Link>
          <Link to="/register" className="text-[#46607a] hover:text-[#137a77] hover:underline dark:text-slate-300">
            Daftar Peserta
          </Link>
        </div>
      </div>
    </footer>
  )
}
