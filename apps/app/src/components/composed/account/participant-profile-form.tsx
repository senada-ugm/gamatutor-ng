import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select"
import { Textarea } from "@workspace/ui/components/textarea"

import { EmptyState } from "@/components/composed/_shared/empty-state"
import { apiSend } from "@/lib/api"
import { EDUCATION_LEVELS, MARITAL_STATUSES, RELIGIONS } from "@/lib/labels"
import type {
  ContractCertificationEntry,
  ContractEducationEntry,
  ContractExperienceEntry,
  ContractParticipantProfile,
} from "@workspace/contracts/domain"

/**
 * The participant's own applicant record — the compliance detail an
 * enrollment is judged on (identity numbers, address, education and work
 * history), which until now only existed as something a manager could
 * read. `PATCH /participant-profiles/{id}` is self-only, so this page is
 * the only way the data ever gets filled in.
 *
 * Everything posts in one PATCH rather than per section: the endpoint
 * treats an omitted field as "leave alone" and `null` as "clear", and the
 * caller owns every field on the form, so one save is both simpler and
 * impossible to leave half-applied.
 */

/** Text inputs hold strings; the wire wants `null` for a cleared field,
 *  never `""` (which would store an empty string as a real value). */
const orNull = (value: string) => (value.trim() === "" ? null : value.trim())
const yearOrUndefined = (value: string) => {
  const parsed = Number(value)
  return value.trim() === "" || !Number.isFinite(parsed) ? undefined : parsed
}

interface ScalarValues {
  phone: string
  profession: string
  institutionName: string
  strNumber: string
  about: string
  educationLevel: string
  address: string
  residentialAddress: string
  dati2: string
  gender: string
  nationality: string
  religion: string
  maritalStatus: string
  birthDate: string
  ktpNumber: string
  bpjsKesehatanNumber: string
}

/** Repeater rows are edited as strings (a half-typed year is not a
 *  number) and converted on save. */
interface EducationRow {
  degree: string
  fieldOfStudy: string
  schoolName: string
  startYear: string
  endYear: string
}
interface ExperienceRow {
  title: string
  company: string
  location: string
  startYear: string
  endYear: string
  ongoing: boolean
}
interface CertificationRow {
  name: string
  issuer: string
  issueYear: string
  expYear: string
}

function scalarsFromProfile(profile: ContractParticipantProfile): ScalarValues {
  return {
    phone: profile.phone ?? "",
    profession: profile.profession ?? "",
    institutionName: profile.institutionName ?? "",
    strNumber: profile.strNumber ?? "",
    about: profile.about ?? "",
    educationLevel: profile.educationLevel ?? "",
    address: profile.address ?? "",
    residentialAddress: profile.residentialAddress ?? "",
    dati2: profile.dati2 ?? "",
    gender: profile.gender ?? "",
    nationality: profile.nationality ?? "",
    religion: profile.religion ?? "",
    maritalStatus: profile.maritalStatus ?? "",
    birthDate: profile.birthDate ?? "",
    ktpNumber: profile.ktpNumber ?? "",
    bpjsKesehatanNumber: profile.bpjsKesehatanNumber ?? "",
  }
}

const emptyEducation: EducationRow = { degree: "", fieldOfStudy: "", schoolName: "", startYear: "", endYear: "" }
const emptyExperience: ExperienceRow = {
  title: "",
  company: "",
  location: "",
  startYear: "",
  endYear: "",
  ongoing: false,
}
const emptyCertification: CertificationRow = { name: "", issuer: "", issueYear: "", expYear: "" }

export function ParticipantProfileForm({ profile }: { profile: ContractParticipantProfile }) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<ScalarValues>(() => scalarsFromProfile(profile))
  const [education, setEducation] = useState<EducationRow[]>(() =>
    profile.education.map((e) => ({
      degree: e.degree,
      fieldOfStudy: e.fieldOfStudy ?? "",
      schoolName: e.schoolName,
      startYear: String(e.startYear),
      endYear: e.endYear == null ? "" : String(e.endYear),
    }))
  )
  const [experience, setExperience] = useState<ExperienceRow[]>(() =>
    profile.experience.map((e) => ({
      title: e.title,
      company: e.company,
      location: e.location ?? "",
      startYear: String(e.startYear),
      endYear: e.endYear == null ? "" : String(e.endYear),
      ongoing: e.ongoing ?? false,
    }))
  )
  const [certifications, setCertifications] = useState<CertificationRow[]>(() =>
    profile.certifications.map((c) => ({
      name: c.name,
      issuer: c.issuer,
      issueYear: String(c.issueYear),
      expYear: c.expYear == null ? "" : String(c.expYear),
    }))
  )

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiSend<ContractParticipantProfile>("PATCH", `/participant-profiles/${profile.id}`, body),
    onSuccess: (updated) => {
      toast.success("Profil disimpan")
      queryClient.setQueryData(["participant-profile", profile.id], updated)
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menyimpan profil"),
  })

  function update<TKey extends keyof ScalarValues>(key: TKey, value: ScalarValues[TKey]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // A row the user started and abandoned would be rejected by the
    // contract's required fields, so drop the blank ones and refuse only
    // the half-filled ones — with the reason, not a generic 400.
    const filledEducation = education.filter((row) => Object.values(row).some((v) => String(v).trim() !== ""))
    if (filledEducation.some((row) => !row.degree.trim() || !row.schoolName.trim() || !row.startYear.trim())) {
      toast.error("Setiap riwayat pendidikan butuh jenjang, nama sekolah, dan tahun mulai")
      return
    }
    const filledExperience = experience.filter((row) =>
      Object.entries(row).some(([key, v]) => key !== "ongoing" && String(v).trim() !== "")
    )
    if (filledExperience.some((row) => !row.title.trim() || !row.company.trim() || !row.startYear.trim())) {
      toast.error("Setiap pengalaman butuh posisi, perusahaan, dan tahun mulai")
      return
    }
    const filledCertifications = certifications.filter((row) => Object.values(row).some((v) => String(v).trim() !== ""))
    if (filledCertifications.some((row) => !row.name.trim() || !row.issuer.trim() || !row.issueYear.trim())) {
      toast.error("Setiap sertifikasi butuh nama, penerbit, dan tahun terbit")
      return
    }

    save.mutate({
      phone: orNull(values.phone),
      profession: orNull(values.profession),
      institutionName: orNull(values.institutionName),
      strNumber: orNull(values.strNumber),
      about: orNull(values.about),
      educationLevel: orNull(values.educationLevel),
      address: orNull(values.address),
      residentialAddress: orNull(values.residentialAddress),
      dati2: orNull(values.dati2),
      gender: values.gender === "" ? null : values.gender,
      nationality: orNull(values.nationality),
      religion: orNull(values.religion),
      maritalStatus: orNull(values.maritalStatus),
      birthDate: orNull(values.birthDate),
      ktpNumber: orNull(values.ktpNumber),
      bpjsKesehatanNumber: orNull(values.bpjsKesehatanNumber),
      education: filledEducation.map((row): ContractEducationEntry => ({
        degree: row.degree.trim(),
        fieldOfStudy: row.fieldOfStudy.trim() || undefined,
        schoolName: row.schoolName.trim(),
        startYear: yearOrUndefined(row.startYear) ?? 0,
        endYear: yearOrUndefined(row.endYear),
      })),
      experience: filledExperience.map((row): ContractExperienceEntry => ({
        title: row.title.trim(),
        company: row.company.trim(),
        location: row.location.trim() || undefined,
        startYear: yearOrUndefined(row.startYear) ?? 0,
        endYear: row.ongoing ? undefined : yearOrUndefined(row.endYear),
        ongoing: row.ongoing,
      })),
      certifications: filledCertifications.map((row): ContractCertificationEntry => ({
        name: row.name.trim(),
        issuer: row.issuer.trim(),
        issueYear: yearOrUndefined(row.issueYear) ?? 0,
        expYear: yearOrUndefined(row.expYear),
      })),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Personal Information & Medical Credentials</CardTitle>
          <CardDescription>Used during clinical screening registration and official certificate generation.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field id="profile-profession" label="Medical Profession">
            <NativeSelect
              id="profile-profession"
              value={values.profession}
              onChange={(e) => update("profession", e.target.value)}
            >
              <NativeSelectOption value="">Select profession</NativeSelectOption>
              <NativeSelectOption value="Puskesmas / Community Health Physician">
                Puskesmas / Community Health Physician
              </NativeSelectOption>
              <NativeSelectOption value="Primary Clinic Physician">Primary Clinic Physician</NativeSelectOption>
              <NativeSelectOption value="Specialist Physician">Specialist Physician</NativeSelectOption>
              <NativeSelectOption value="Resident Physician">Resident Physician</NativeSelectOption>
              <NativeSelectOption value="Other Healthcare Professional">Other Healthcare Professional</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field id="profile-institution" label="Institution / Health Center">
            <Input
              id="profile-institution"
              value={values.institutionName}
              onChange={(e) => update("institutionName", e.target.value)}
              placeholder="e.g. Puskesmas Sleman"
            />
          </Field>
          <Field id="profile-str" label="Doctor Registration Number (STR)">
            <Input
              id="profile-str"
              value={values.strNumber}
              onChange={(e) => update("strNumber", e.target.value)}
              placeholder="Active STR number (optional)"
            />
          </Field>
          <Field id="profile-phone" label="Phone / WhatsApp">
            <Input
              id="profile-phone"
              value={values.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="08123456789"
            />
          </Field>
          <Field id="profile-birthdate" label="Tanggal Lahir">
            <Input
              id="profile-birthdate"
              type="date"
              value={values.birthDate}
              onChange={(e) => update("birthDate", e.target.value)}
            />
          </Field>
          <Field id="profile-gender" label="Jenis Kelamin">
            <NativeSelect
              id="profile-gender"
              className="w-full"
              value={values.gender}
              onChange={(e) => update("gender", e.target.value)}
            >
              <NativeSelectOption value="">Belum diisi</NativeSelectOption>
              <NativeSelectOption value="male">Laki-laki</NativeSelectOption>
              <NativeSelectOption value="female">Perempuan</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field id="profile-marital" label="Status Pernikahan">
            <NativeSelect
              id="profile-marital"
              className="w-full"
              value={values.maritalStatus}
              onChange={(e) => update("maritalStatus", e.target.value)}
            >
              <NativeSelectOption value="">Belum diisi</NativeSelectOption>
              {MARITAL_STATUSES.map((s) => (
                <NativeSelectOption key={s.value} value={s.value}>
                  {s.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field id="profile-nationality" label="Kewarganegaraan">
            <Input
              id="profile-nationality"
              value={values.nationality}
              onChange={(e) => update("nationality", e.target.value)}
              placeholder="Indonesia"
            />
          </Field>
          <Field id="profile-religion" label="Agama">
            <NativeSelect
              id="profile-religion"
              className="w-full"
              value={values.religion}
              onChange={(e) => update("religion", e.target.value)}
            >
              <NativeSelectOption value="">Belum diisi</NativeSelectOption>
              {RELIGIONS.map((r) => (
                <NativeSelectOption key={r} value={r}>
                  {r}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field id="profile-education-level" label="Pendidikan Terakhir">
            <NativeSelect
              id="profile-education-level"
              className="w-full"
              value={values.educationLevel}
              onChange={(e) => update("educationLevel", e.target.value)}
            >
              <NativeSelectOption value="">Belum diisi</NativeSelectOption>
              {EDUCATION_LEVELS.map((level) => (
                <NativeSelectOption key={level.value} value={level.value}>
                  {level.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field id="profile-dati2" label="Kota/Kabupaten">
            <Input id="profile-dati2" value={values.dati2} onChange={(e) => update("dati2", e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field id="profile-about" label="Tentang Saya">
              <Textarea
                id="profile-about"
                rows={3}
                value={values.about}
                onChange={(e) => update("about", e.target.value)}
                placeholder="Ringkas latar belakang dan minat Anda."
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alamat &amp; Identitas</CardTitle>
          <CardDescription>
            Nomor identitas disimpan terenkripsi dan hanya Anda yang dapat melihatnya utuh — pengelola pelatihan hanya
            melihat empat digit terakhir.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field id="profile-address" label="Alamat Sesuai KTP">
              <Textarea
                id="profile-address"
                rows={2}
                value={values.address}
                onChange={(e) => update("address", e.target.value)}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field id="profile-residential" label="Alamat Tinggal (bila berbeda)">
              <Textarea
                id="profile-residential"
                rows={2}
                value={values.residentialAddress}
                onChange={(e) => update("residentialAddress", e.target.value)}
              />
            </Field>
          </div>
          <Field id="profile-ktp" label="Nomor KTP (NIK)">
            <Input
              id="profile-ktp"
              inputMode="numeric"
              value={values.ktpNumber}
              onChange={(e) => update("ktpNumber", e.target.value)}
              placeholder="16 digit"
            />
          </Field>
          <Field id="profile-bpjs" label="BPJS Kesehatan">
            <Input
              id="profile-bpjs"
              inputMode="numeric"
              value={values.bpjsKesehatanNumber}
              onChange={(e) => update("bpjsKesehatanNumber", e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <RepeaterCard
        title="Pendidikan"
        description="Riwayat sekolah dan kuliah, terbaru lebih dulu."
        addLabel="Tambah Pendidikan"
        emptyTitle="Belum ada riwayat pendidikan"
        rows={education}
        onAdd={() => setEducation((prev) => [...prev, { ...emptyEducation }])}
        onRemove={(i) => setEducation((prev) => prev.filter((_, idx) => idx !== i))}
        renderRow={(row, i) => {
          const set = (patch: Partial<EducationRow>) =>
            setEducation((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
          return (
            <>
              <Field id={`edu-degree-${i}`} label="Jenjang / Gelar">
                <Input id={`edu-degree-${i}`} value={row.degree} onChange={(e) => set({ degree: e.target.value })} />
              </Field>
              <Field id={`edu-field-${i}`} label="Jurusan">
                <Input
                  id={`edu-field-${i}`}
                  value={row.fieldOfStudy}
                  onChange={(e) => set({ fieldOfStudy: e.target.value })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field id={`edu-school-${i}`} label="Nama Sekolah / Kampus">
                  <Input
                    id={`edu-school-${i}`}
                    value={row.schoolName}
                    onChange={(e) => set({ schoolName: e.target.value })}
                  />
                </Field>
              </div>
              <Field id={`edu-start-${i}`} label="Tahun Mulai">
                <Input
                  id={`edu-start-${i}`}
                  type="number"
                  value={row.startYear}
                  onChange={(e) => set({ startYear: e.target.value })}
                />
              </Field>
              <Field id={`edu-end-${i}`} label="Tahun Selesai">
                <Input
                  id={`edu-end-${i}`}
                  type="number"
                  value={row.endYear}
                  onChange={(e) => set({ endYear: e.target.value })}
                  placeholder="Kosongkan bila masih berjalan"
                />
              </Field>
            </>
          )
        }}
      />

      <RepeaterCard
        title="Pengalaman Kerja"
        description="Posisi yang pernah dijalani."
        addLabel="Tambah Pengalaman"
        emptyTitle="Belum ada pengalaman kerja"
        rows={experience}
        onAdd={() => setExperience((prev) => [...prev, { ...emptyExperience }])}
        onRemove={(i) => setExperience((prev) => prev.filter((_, idx) => idx !== i))}
        renderRow={(row, i) => {
          const set = (patch: Partial<ExperienceRow>) =>
            setExperience((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
          return (
            <>
              <Field id={`exp-title-${i}`} label="Posisi">
                <Input id={`exp-title-${i}`} value={row.title} onChange={(e) => set({ title: e.target.value })} />
              </Field>
              <Field id={`exp-company-${i}`} label="Perusahaan">
                <Input id={`exp-company-${i}`} value={row.company} onChange={(e) => set({ company: e.target.value })} />
              </Field>
              <Field id={`exp-location-${i}`} label="Lokasi">
                <Input
                  id={`exp-location-${i}`}
                  value={row.location}
                  onChange={(e) => set({ location: e.target.value })}
                />
              </Field>
              <Field id={`exp-start-${i}`} label="Tahun Mulai">
                <Input
                  id={`exp-start-${i}`}
                  type="number"
                  value={row.startYear}
                  onChange={(e) => set({ startYear: e.target.value })}
                />
              </Field>
              <Field id={`exp-end-${i}`} label="Tahun Selesai">
                <Input
                  id={`exp-end-${i}`}
                  type="number"
                  value={row.endYear}
                  disabled={row.ongoing}
                  onChange={(e) => set({ endYear: e.target.value })}
                />
              </Field>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <Checkbox
                  checked={row.ongoing}
                  onCheckedChange={(checked) => set({ ongoing: checked === true, endYear: "" })}
                />
                Masih bekerja di sini
              </label>
            </>
          )
        }}
      />

      <RepeaterCard
        title="Sertifikasi"
        description="Sertifikat kompetensi atau pelatihan di luar platform ini."
        addLabel="Tambah Sertifikasi"
        emptyTitle="Belum ada sertifikasi"
        rows={certifications}
        onAdd={() => setCertifications((prev) => [...prev, { ...emptyCertification }])}
        onRemove={(i) => setCertifications((prev) => prev.filter((_, idx) => idx !== i))}
        renderRow={(row, i) => {
          const set = (patch: Partial<CertificationRow>) =>
            setCertifications((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
          return (
            <>
              <Field id={`cert-name-${i}`} label="Nama Sertifikat">
                <Input id={`cert-name-${i}`} value={row.name} onChange={(e) => set({ name: e.target.value })} />
              </Field>
              <Field id={`cert-issuer-${i}`} label="Penerbit">
                <Input id={`cert-issuer-${i}`} value={row.issuer} onChange={(e) => set({ issuer: e.target.value })} />
              </Field>
              <Field id={`cert-issued-${i}`} label="Tahun Terbit">
                <Input
                  id={`cert-issued-${i}`}
                  type="number"
                  value={row.issueYear}
                  onChange={(e) => set({ issueYear: e.target.value })}
                />
              </Field>
              <Field id={`cert-exp-${i}`} label="Berlaku Sampai">
                <Input
                  id={`cert-exp-${i}`}
                  type="number"
                  value={row.expYear}
                  onChange={(e) => set({ expYear: e.target.value })}
                  placeholder="Kosongkan bila tanpa masa berlaku"
                />
              </Field>
            </>
          )
        }}
      />

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={save.isPending}>
          {save.isPending ? "Menyimpan..." : "Simpan Profil"}
        </Button>
      </div>
    </form>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

/** The three repeaters differ only in their fields, so the card, the
 *  add/remove chrome and the empty state live here once. */
function RepeaterCard<TRow>({
  title,
  description,
  addLabel,
  emptyTitle,
  rows,
  onAdd,
  onRemove,
  renderRow,
}: {
  title: string
  description: string
  addLabel: string
  emptyTitle: string
  rows: TRow[]
  onAdd: () => void
  onRemove: (index: number) => void
  renderRow: (row: TRow, index: number) => React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <EmptyState compact title={emptyTitle} description={description} />
        ) : (
          rows.map((row, index) => (
            <div key={index} className="rounded-lg border bg-muted/20 p-4 transition-colors">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  {title} {index + 1}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Hapus ${title.toLowerCase()} ${index + 1}`}
                  onClick={() => onRemove(index)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">{renderRow(row, index)}</div>
            </div>
          ))
        )}
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>
          <Plus className="size-4" />
          {addLabel}
        </Button>
      </CardContent>
    </Card>
  )
}
