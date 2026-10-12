import { Link } from "@tanstack/react-router"
import { GraduationCap } from "lucide-react"

/**
 * The auth scaffold, mirroring the shadcn login-02 block page layout
 * (packages/ui/src/components/login-form.tsx holds the registry's form
 * half — never hand-edited): a two-column split with the form column
 * (brand row + centered max-w-xs form) on the left and a neutral muted
 * panel on the right, hidden below lg. Every auth surface (login,
 * register, forgot/reset password) renders inside it.
 */
export function AuthPage({
  title,
  description,
  children,
}: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link to="/login" className="flex items-center gap-2 font-medium">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GraduationCap className="size-4" />
            </div>
            LMS
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <div className="mb-6 flex flex-col items-center gap-1 text-center">
              <h1 className="text-2xl font-bold">{title}</h1>
              {description ? <p className="text-sm text-balance text-muted-foreground">{description}</p> : null}
            </div>
            {children}
          </div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block" aria-hidden="true">
        {/* Template-neutral cover: a faint dot grid drawn inline so it
            tracks the theme (currentColor) instead of a fixed asset. */}
        <svg className="absolute inset-0 h-full w-full text-foreground/5">
          <defs>
            <pattern id="auth-dots" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.5" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#auth-dots)" />
        </svg>
      </div>
    </div>
  )
}
