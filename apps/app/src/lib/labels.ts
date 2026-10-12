/** Human-readable Indonesian labels for enum-ish course fields — raw
 *  contract values ("beginner", "online") must never reach the UI. */

export const LEVEL_LABELS: Record<string, string> = {
  beginner: "Pemula",
  intermediate: "Menengah",
  advanced: "Lanjutan",
  expert: "Ahli",
}

export const COURSE_TYPE_LABELS: Record<string, string> = {
  online: "Online",
  offline: "Tatap Muka",
  hybrid: "Hybrid",
}

export const INSTITUTION_TYPES = [
  { value: "company", label: "Perusahaan" },
  { value: "government", label: "Pemerintahan" },
  { value: "education", label: "Pendidikan" },
  { value: "nonprofit", label: "Nirlaba" },
  { value: "other", label: "Lainnya" },
]

/** Indonesian education ladder, as the participant profile's
 *  `educationLevel` stores it. Ordered lowest to highest so the select
 *  reads like the ladder itself. */
export const EDUCATION_LEVELS = [
  { value: "sd", label: "SD" },
  { value: "smp", label: "SMP" },
  { value: "sma", label: "SMA/SMK" },
  { value: "d1", label: "D1" },
  { value: "d2", label: "D2" },
  { value: "d3", label: "D3" },
  { value: "d4", label: "D4" },
  { value: "s1", label: "S1 (Sarjana)" },
  { value: "s2", label: "S2 (Magister)" },
  { value: "s3", label: "S3 (Doktor)" },
]

export const EDUCATION_LEVEL_LABELS: Record<string, string> = Object.fromEntries(
  EDUCATION_LEVELS.map((e) => [e.value, e.label])
)

export const GENDER_LABELS: Record<string, string> = {
  male: "Laki-laki",
  female: "Perempuan",
}

/** Free-text on the wire (the contract does not constrain it), but the
 *  six state-recognised religions are what a form should offer. */
export const RELIGIONS = ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu"]

export const MARITAL_STATUSES = [
  { value: "single", label: "Belum Menikah" },
  { value: "married", label: "Menikah" },
  { value: "divorced", label: "Cerai" },
  { value: "widowed", label: "Cerai Mati" },
]
