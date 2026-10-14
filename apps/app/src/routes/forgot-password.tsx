import { Link } from "@tanstack/react-router"
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

import { AuthPage } from "@/components/composed/_shared/auth-page"
import { API_URL } from "@/lib/api"

// Direct fetch rather than the auth client: better-auth 1.7.x's client
// method names for this flow don't line up with its own server paths
// (forgetPassword -> /forget-password, server serves
// /request-password-reset). The browser sets the Origin header on the
// cross-origin POST automatically, which satisfies Better Auth's CSRF.
async function requestPasswordReset(email: string, redirectTo: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_URL}/api/auth/request-password-reset`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, redirectTo }),
  })
  return { ok: res.ok }
}

/**
 * Self-service password recovery, step 1: request the reset link.
 * Better Auth emails a tokenized link (via Resend, or the API console
 * when unconfigured) pointing at /reset-password in this SPA.
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    const { ok } = await requestPasswordReset(email.trim(), `${window.location.origin}/reset-password`)
    setSubmitting(false)
    if (!ok) {
      setError("Gagal mengirim tautan pemulihan")
      return
    }
    // Deliberately vague either way — never reveal whether the account exists.
    setSent(true)
  }

  return (
    <AuthPage
      title="Lupa Kata Sandi"
      description={
        sent
          ? "Jika email tersebut terdaftar, tautan pemulihan telah dikirim. Periksa kotak masuk Anda."
          : "Masukkan email akun Anda dan kami kirimkan tautan pemulihan."
      }
    >
      {sent ? (
        <Button nativeButton={false} render={<Link to="/login" />}>
          Kembali ke Masuk
        </Button>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <FieldGroup>
            {error ? (
              <FieldDescription role="alert" className="text-destructive">
                {error}
              </FieldDescription>
            ) : null}
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </Field>
            <Field>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Mengirim..." : "Kirim Tautan Pemulihan"}
              </Button>
            </Field>
            <FieldDescription className="text-center">
              <Link to="/login" className="underline underline-offset-4">
                Kembali ke Masuk
              </Link>
            </FieldDescription>
          </FieldGroup>
        </form>
      )}
    </AuthPage>
  )
}
