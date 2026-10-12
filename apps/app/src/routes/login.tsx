import { Link, useNavigate } from "@tanstack/react-router"
import { useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

import { AuthPage } from "@/components/composed/_shared/auth-page"
import { signIn } from "@/lib/auth"

export function LoginPage() {
  const navigate = useNavigate()
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignIn() {
    if (submitting) return
    const email = emailRef.current?.value?.trim() ?? ""
    const password = passwordRef.current?.value ?? ""
    if (!email || !password) {
      setError("Isi email dan kata sandi")
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const user = await signIn(email, password)
      if (!user) {
        setError("Email atau kata sandi salah")
        return
      }
      navigate({ to: "/dashboard" })
    } catch {
      setError("Terjadi kesalahan jaringan")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthPage title="Masuk" description="Masuk untuk melanjutkan pelatihan Anda.">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void handleSignIn()
        }}
        className="flex flex-col gap-6"
      >
        <FieldGroup>
          {error ? (
            <FieldDescription role="alert" className="text-destructive">
              {error}
            </FieldDescription>
          ) : null}
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input ref={emailRef} id="email" type="email" autoComplete="email" required />
          </Field>
          <Field>
            <div className="flex items-center">
              <FieldLabel htmlFor="password">Kata Sandi</FieldLabel>
              <Link to="/forgot-password" className="ms-auto text-sm underline-offset-4 hover:underline">
                Lupa kata sandi?
              </Link>
            </div>
            <Input ref={passwordRef} id="password" type="password" autoComplete="current-password" required />
          </Field>
          <Field>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Memproses..." : "Masuk"}
            </Button>
          </Field>
          <FieldDescription className="text-center">
            Belum punya akun?{" "}
            <Link to="/register" className="underline underline-offset-4">
              Daftar
            </Link>
          </FieldDescription>
        </FieldGroup>
      </form>
    </AuthPage>
  )
}
