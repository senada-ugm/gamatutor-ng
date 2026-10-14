import { Link, useNavigate } from "@tanstack/react-router"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select"

import { AuthPage } from "@/components/composed/_shared/auth-page"
import { signUp } from "@/lib/auth"
import { CLINICAL_PROFESSIONS, INDONESIA_PROVINCES } from "@/lib/clinical-options"

export function RegisterPage() {
  const navigate = useNavigate()
  const nameRef = useRef<HTMLInputElement>(null)
  const birthDateRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const institutionRef = useRef<HTMLInputElement>(null)
  const cityRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const passwordConfirmRef = useRef<HTMLInputElement>(null)

  const [profession, setProfession] = useState<string>(CLINICAL_PROFESSIONS[0])
  const [province, setProvince] = useState<string>("DI Yogyakarta")
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRegister() {
    if (submitting) return

    const fullName = nameRef.current?.value?.trim() ?? ""
    const birthDate = birthDateRef.current?.value?.trim() ?? ""
    const phone = phoneRef.current?.value?.trim() ?? ""
    const institution = institutionRef.current?.value?.trim() ?? ""
    const city = cityRef.current?.value?.trim() ?? ""
    const email = emailRef.current?.value?.trim() ?? ""
    const password = passwordRef.current?.value ?? ""
    const passwordConfirm = passwordConfirmRef.current?.value ?? ""

    if (!fullName || !birthDate || !phone || !institution || !city || !email || !password) {
      setError("Semua bidang wajib diisi.")
      return
    }

    if (password.length < 8) {
      setError("Kata sandi minimal 8 karakter.")
      return
    }

    if (password !== passwordConfirm) {
      setError("Konfirmasi kata sandi tidak sama.")
      return
    }

    if (!consent) {
      setError("Anda perlu menyetujui penggunaan data untuk pelatihan.")
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const ok = await signUp(fullName, email, password)
      if (!ok) {
        setError("Email ini mungkin sudah terdaftar.")
        return
      }

      // Simpan data profil klinis untuk sinkronisasi profil peserta
      localStorage.setItem(
        "pending_doctor_profile",
        JSON.stringify({
          fullName,
          birthDate,
          phone,
          profession,
          institutionName: institution,
          province,
          city,
        })
      )

      toast.success("Pendaftaran berhasil. Silakan periksa email Anda untuk verifikasi atau masuk langsung.", {
        duration: 8000,
      })
      navigate({ to: "/login" })
    } catch {
      setError("Terjadi kesalahan jaringan. Silakan coba lagi.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthPage
      maxWidth="max-w-xl"
      title="Daftar sebagai peserta"
      description="Lengkapi data berikut. Nama lengkap akan tercetak pada sertifikat resmi, jadi pastikan penulisan dan gelarnya benar."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void handleRegister()
        }}
        className="flex flex-col gap-6"
      >
        <FieldGroup>
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive">
              {error}
            </div>
          ) : null}

          <div className="border-b pb-2">
            <h2 className="text-sm font-bold tracking-wide text-foreground uppercase">Data Diri Peserta</h2>
          </div>

          <Field>
            <FieldLabel htmlFor="fullName">Nama lengkap (beserta gelar)</FieldLabel>
            <Input
              ref={nameRef}
              id="fullName"
              autoComplete="name"
              placeholder="contoh: dr. Anisa Rahmawati, Sp.M"
              required
            />
            <FieldDescription>
              Nama ini dicetak pada sertifikat. Tulis persis seperti yang Anda inginkan.
            </FieldDescription>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="birthDate">Tanggal lahir</FieldLabel>
              <Input ref={birthDateRef} id="birthDate" type="date" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="phone">Nomor telepon / WhatsApp</FieldLabel>
              <Input ref={phoneRef} id="phone" type="tel" placeholder="0812xxxxxxx" required />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="profession">Profesi</FieldLabel>
              <NativeSelect id="profession" value={profession} onChange={(e) => setProfession(e.target.value)} required>
                {CLINICAL_PROFESSIONS.map((p) => (
                  <NativeSelectOption key={p} value={p}>
                    {p}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="institution">Instansi / Fasilitas Kesehatan</FieldLabel>
              <Input
                ref={institutionRef}
                id="institution"
                placeholder="contoh: RS Sardjito, Puskesmas Sleman"
                required
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="province">Provinsi</FieldLabel>
              <NativeSelect id="province" value={province} onChange={(e) => setProvince(e.target.value)} required>
                {INDONESIA_PROVINCES.map((prov) => (
                  <NativeSelectOption key={prov} value={prov}>
                    {prov}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="city">Kabupaten / Kota</FieldLabel>
              <Input ref={cityRef} id="city" placeholder="contoh: Sleman, Yogyakarta" required />
            </Field>
          </div>

          <div className="border-b pt-2 pb-2">
            <h2 className="text-sm font-bold tracking-wide text-foreground uppercase">Informasi Akun</h2>
          </div>

          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              ref={emailRef}
              id="email"
              type="email"
              autoComplete="email"
              placeholder="nama@instansi.id"
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="password">Kata sandi</FieldLabel>
              <Input
                ref={passwordRef}
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="Minimal 8 karakter"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="passwordConfirm">Ulangi kata sandi</FieldLabel>
              <Input
                ref={passwordConfirmRef}
                id="passwordConfirm"
                type="password"
                autoComplete="new-password"
                placeholder="Ketik ulang sandi"
                required
              />
            </Field>
          </div>

          <div className="flex items-start gap-3 pt-2">
            <Checkbox
              id="consent"
              checked={consent}
              onCheckedChange={(checked) => setConsent(checked === true)}
              className="mt-1"
            />
            <FieldLabel htmlFor="consent" className="text-xs leading-relaxed font-normal text-muted-foreground">
              Saya setuju data di atas digunakan untuk penyelenggaraan pelatihan, penerbitan sertifikat resmi, dan
              evaluasi program oleh tim DRIVE.
            </FieldLabel>
          </div>

          <Field className="pt-2">
            <Button type="submit" disabled={submitting} className="w-full bg-[#173a5e] text-white hover:bg-[#132d47]">
              {submitting ? "Memproses…" : "Daftar"}
            </Button>
          </Field>

          <FieldDescription className="text-center text-xs">
            Sudah memiliki akun?{" "}
            <Link to="/login" className="font-semibold text-primary underline underline-offset-4">
              Masuk di sini
            </Link>
          </FieldDescription>
        </FieldGroup>
      </form>
    </AuthPage>
  )
}
