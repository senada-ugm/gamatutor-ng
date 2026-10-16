import { Link } from "@tanstack/react-router"
import { Eye } from "lucide-react"

/**
 * The auth scaffold, mirroring the shadcn login-02 block page layout
 * (packages/ui/src/components/login-form.tsx holds the registry's form
 * half — never hand-edited): a two-column split with the image panel
 * (full-bleed background + tagline overlay) on the left, hidden below
 * lg, and the form column (brand row + centered max-w-xs form) on the
 * right. Every auth surface (login, register, forgot/reset password)
 * renders inside it.
 */
export function AuthPage({
  title,
  description,
  children,
  maxWidth = "max-w-xs",
}: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  maxWidth?: string
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-slate-900 lg:block" aria-hidden="true">
        {/* Photo: Vivek Doshi on Unsplash (unsplash.com/photos/zziTPieyuBI), Unsplash License. */}
        <img
          src="/images/peacock-auth-bg.jpg"
          alt="Burung merak biru-hijau mengembangkan ekornya di atas rumput"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-slate-900/10" />
        <div className="absolute inset-x-0 bottom-0 p-10 text-white">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Pelatihan Skrining Retinopati Diabetika
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-200">
            Platform pembelajaran klinis interaktif terakreditasi untuk dokter layanan primer dan tenaga kesehatan.
          </p>
        </div>
      </div>{" "}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link to="/" className="flex items-center gap-2 font-medium" aria-label="Kembali ke Beranda">
            <div className="flex size-7 items-center justify-center rounded-full bg-[#0369a1] text-xs font-black text-white shadow-xs">
              <Eye className="size-4 stroke-[2.2]" />
            </div>
            <span className="font-extrabold tracking-tight">
              DRIVE <span className="font-semibold text-sky-700 dark:text-sky-400">Learn</span>
            </span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className={`w-full ${maxWidth}`}>
            <div className="mb-6 flex flex-col items-center gap-1 text-center">
              <h1 className="text-2xl font-bold">{title}</h1>
              {description ? <p className="text-sm text-balance text-muted-foreground">{description}</p> : null}
            </div>
            {children}
          </div>
        </div>
      </div>{" "}
    </div>
  )
}
