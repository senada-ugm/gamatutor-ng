import { Link, useNavigate } from "@tanstack/react-router"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select"

import { AuthPage } from "@/components/composed/_shared/auth-page"
import { signUp } from "@/lib/auth"

export function RegisterPage() {
  const navigate = useNavigate()
  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const institutionRef = useRef<HTMLInputElement>(null)
  const strRef = useRef<HTMLInputElement>(null)
  const birthDateRef = useRef<HTMLInputElement>(null)
  const [profession, setProfession] = useState("Dokter Umum Puskesmas")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRegister() {
    if (submitting) return
    const name = nameRef.current?.value?.trim() ?? ""
    const email = emailRef.current?.value?.trim() ?? ""
    const password = passwordRef.current?.value ?? ""
    const phone = phoneRef.current?.value?.trim() ?? ""
    const institutionName = institutionRef.current?.value?.trim() ?? ""
    const strNumber = strRef.current?.value?.trim() ?? ""
    const birthDate = birthDateRef.current?.value?.trim() ?? ""

    if (!name || !email || password.length < 8) {
      setError("All required fields must be filled (password minimum 8 characters)")
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const ok = await signUp(name, email, password)
      if (!ok) {
        setError("This email may already be registered")
        return
      }

      // Stash complete doctor profile to be synced upon session activation
      localStorage.setItem(
        "pending_doctor_profile",
        JSON.stringify({
          profession,
          institutionName,
          strNumber: strNumber || null,
          phone: phone || null,
          birthDate: birthDate || null,
        })
      )

      toast.success("Account created — please check your email for verification before signing in.", {
        duration: 8000,
      })
      navigate({ to: "/login" })
    } catch {
      setError("A network error occurred. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthPage
      title="Doctor Participant Registration"
      description="Register for Diabetic Retinopathy Screening Training to earn an official accredited certificate."
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
            <FieldDescription role="alert" className="text-destructive">
              {error}
            </FieldDescription>
          ) : null}
          <Field>
            <FieldLabel htmlFor="name">Full Name & Medical Title</FieldLabel>
            <Input ref={nameRef} id="name" autoComplete="name" placeholder="e.g. dr. Anisa Rahmawati" required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="profession">Medical Profession</FieldLabel>
              <NativeSelect id="profession" value={profession} onChange={(e) => setProfession(e.target.value)} required>
                <NativeSelectOption value="Puskesmas / Community Health Physician">
                  Puskesmas / Community Health Physician
                </NativeSelectOption>
                <NativeSelectOption value="Primary Clinic Physician">Primary Clinic Physician</NativeSelectOption>
                <NativeSelectOption value="Specialist Physician">Specialist Physician</NativeSelectOption>
                <NativeSelectOption value="Resident Physician">Resident Physician</NativeSelectOption>
                <NativeSelectOption value="Other Healthcare Professional">
                  Other Healthcare Professional
                </NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="institution">Institution / Health Center</FieldLabel>
              <Input ref={institutionRef} id="institution" placeholder="e.g. Puskesmas Sleman" required />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="phone">WhatsApp / Mobile Phone</FieldLabel>
              <Input ref={phoneRef} id="phone" type="tel" placeholder="08123456789" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="birthDate">Birth Date</FieldLabel>
              <Input ref={birthDateRef} id="birthDate" type="date" required />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="strNumber">Doctor Registration Number (STR)</FieldLabel>
            <Input ref={strRef} id="strNumber" placeholder="Active STR number (optional)" />
            <FieldDescription>Recommended for professional verification and certificate metadata.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input ref={emailRef} id="email" type="email" autoComplete="email" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input ref={passwordRef} id="password" type="password" autoComplete="new-password" required />
            <FieldDescription>Minimum 8 characters.</FieldDescription>
          </Field>
          <Field>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Processing..." : "Register Now"}
            </Button>
          </Field>
          <FieldDescription className="text-center">
            Already have an account?{" "}
            <Link to="/login" className="underline underline-offset-4">
              Sign In
            </Link>
          </FieldDescription>
        </FieldGroup>
      </form>
    </AuthPage>
  )
}
