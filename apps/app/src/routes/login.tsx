import { Link, useNavigate } from "@tanstack/react-router"
import { useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

import { AuthPage } from "@/components/composed/_shared/auth-page"
import { DevModeBar } from "@/components/composed/auth/dev-mode-bar"
import { signIn } from "@/lib/auth"

import { apiSend } from "@/lib/api"

export function LoginPage() {
  const navigate = useNavigate()
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignIn(overrideEmail?: string, overridePassword?: string) {
    if (submitting) return
    const email = overrideEmail ?? emailRef.current?.value?.trim() ?? ""
    const password = overridePassword ?? passwordRef.current?.value ?? ""
    if (emailRef.current && overrideEmail) emailRef.current.value = overrideEmail
    if (passwordRef.current && overridePassword) passwordRef.current.value = overridePassword

    if (!email || !password) {
      setError("Please enter your email and password")
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const user = await signIn(email, password)
      if (!user) {
        setError("Invalid email or password")
        return
      }

      // Sync pending doctor profile from registration if present
      const pendingProfile = localStorage.getItem("pending_doctor_profile")
      if (pendingProfile && user.id) {
        try {
          const parsed = JSON.parse(pendingProfile)
          await apiSend("PATCH", `/participant-profiles/${user.id}`, parsed)
          localStorage.removeItem("pending_doctor_profile")
        } catch {
          // Non-blocking sync failure
        }
      }

      navigate({ to: "/dashboard" })
    } catch {
      setError("A network error occurred. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthPage title="Masuk" description="Masuk ke platform untuk melanjutkan pelatihan klinis Anda.">
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
            <Button type="submit" disabled={submitting} className="w-full bg-[#173a5e] text-white hover:bg-[#132d47]">
              {submitting ? "Memproses…" : "Masuk"}
            </Button>
          </Field>
          <DevModeBar
            onSelectAccount={(email, password) => {
              void handleSignIn(email, password)
            }}
            submitting={submitting}
          />
          <FieldDescription className="text-center text-xs">
            Belum punya akun?{" "}
            <Link to="/register" className="font-semibold text-primary underline underline-offset-4">
              Daftar sebagai peserta
            </Link>
          </FieldDescription>
        </FieldGroup>
      </form>
    </AuthPage>
  )
}
