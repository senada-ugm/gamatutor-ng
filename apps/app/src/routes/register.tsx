import { Link, useNavigate } from "@tanstack/react-router"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

import { AuthPage } from "@/components/composed/_shared/auth-page"
import { signUp } from "@/lib/auth"

export function RegisterPage() {
  const navigate = useNavigate()
  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRegister() {
    if (submitting) return
    const name = nameRef.current?.value?.trim() ?? ""
    const email = emailRef.current?.value?.trim() ?? ""
    const password = passwordRef.current?.value ?? ""
    if (!name || !email || password.length < 8) {
      setError("Semua kolom wajib diisi (kata sandi minimal 8 karakter)")
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const ok = await signUp(name, email, password)
      if (!ok) {
        setError("Email mungkin sudah digunakan")
        return
      }
      toast.success("Akun dibuat — periksa email Anda untuk tautan verifikasi sebelum masuk.", {
        duration: 8000,
      })
      navigate({ to: "/login" })
    } catch {
      setError("Terjadi kesalahan jaringan")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthPage title="Buat Akun" description="Daftar untuk mengikuti pelatihan dan mendapatkan sertifikat.">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void handleRegister()
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
            <FieldLabel htmlFor="name">Nama Lengkap</FieldLabel>
            <Input ref={nameRef} id="name" autoComplete="name" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input ref={emailRef} id="email" type="email" autoComplete="email" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Kata Sandi</FieldLabel>
            <Input ref={passwordRef} id="password" type="password" autoComplete="new-password" required />
            <FieldDescription>Minimal 8 karakter.</FieldDescription>
          </Field>
          <Field>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Memproses..." : "Daftar"}
            </Button>
          </Field>
          <FieldDescription className="text-center">
            Sudah punya akun?{" "}
            <Link to="/login" className="underline underline-offset-4">
              Masuk
            </Link>
          </FieldDescription>
        </FieldGroup>
      </form>
    </AuthPage>
  )
}
