import { Link, useNavigate, useSearch } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"

import { AuthPage } from "@/components/composed/_shared/auth-page"
import { authClient } from "@/lib/auth-client"

/**
 * Self-service password recovery, step 2: the emailed link lands here
 * with ?token=…; set the new password and return to login.
 */
export function ResetPasswordPage() {
  const { token } = useSearch({ from: "/reset-password" })
  const navigate = useNavigate()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    if (password.length < 8) {
      setError("Kata sandi minimal 8 karakter")
      return
    }
    if (password !== confirm) {
      setError("Konfirmasi kata sandi tidak cocok")
      return
    }
    setSubmitting(true)
    setError(null)
    const { error: resetError } = await authClient.resetPassword({
      newPassword: password,
      token,
    })
    setSubmitting(false)
    if (resetError) {
      setError(resetError.message ?? "Tautan pemulihan tidak valid atau sudah dipakai")
      return
    }
    toast.success("Kata sandi berhasil diubah — silakan masuk kembali")
    navigate({ to: "/login" })
  }

  if (!token) {
    return (
      <AuthPage
        title="Tautan Tidak Valid"
        description="Tautan pemulihan tidak menyertakan token. Minta tautan baru dari halaman lupa kata sandi."
      >
        <Button className="w-full" nativeButton={false} render={<Link to="/forgot-password" />}>
          Minta Tautan Baru
        </Button>
      </AuthPage>
    )
  }

  return (
    <AuthPage title="Atur Kata Sandi Baru" description="Kata sandi baru berlaku untuk semua sesi berikutnya.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <FieldGroup>
          {error ? (
            <FieldDescription role="alert" className="text-destructive">
              {error}
            </FieldDescription>
          ) : null}
          <Field>
            <FieldLabel htmlFor="password">Kata Sandi Baru</FieldLabel>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="confirm">Konfirmasi Kata Sandi</FieldLabel>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
          <Field>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </AuthPage>
  )
}
