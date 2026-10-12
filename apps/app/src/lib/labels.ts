/** Human-readable English labels for enum-ish course fields — raw
 *  contract values ("beginner", "online") must never reach the UI unformatted. */

export const LEVEL_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
}

export const COURSE_TYPE_LABELS: Record<string, string> = {
  online: "Online",
  offline: "In-Person",
  hybrid: "Hybrid",
}

export const INSTITUTION_TYPES = [
  { value: "company", label: "Company" },
  { value: "government", label: "Government" },
  { value: "education", label: "Education / Academic" },
  { value: "nonprofit", label: "Nonprofit" },
  { value: "other", label: "Other" },
]

/** Education ladder, as the participant profile's
 *  `educationLevel` stores it. Ordered lowest to highest so the select
 *  reads like the ladder itself. */
export const EDUCATION_LEVELS = [
  { value: "sd", label: "Elementary School" },
  { value: "smp", label: "Junior High School" },
  { value: "sma", label: "Senior High School" },
  { value: "d1", label: "Diploma 1" },
  { value: "d2", label: "Diploma 2" },
  { value: "d3", label: "Diploma 3" },
  { value: "d4", label: "Diploma 4" },
  { value: "s1", label: "Bachelor's Degree (S1)" },
  { value: "s2", label: "Master's Degree (S2)" },
  { value: "s3", label: "Doctorate Degree (S3)" },
]

export const EDUCATION_LEVEL_LABELS: Record<string, string> = Object.fromEntries(
  EDUCATION_LEVELS.map((e) => [e.value, e.label])
)

export const GENDER_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
}

/** Free-text on the wire (the contract does not constrain it). */
export const RELIGIONS = ["Islam", "Protestant", "Catholic", "Hindu", "Buddhist", "Confucian", "Other"]

export const MARITAL_STATUSES = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "divorced", label: "Divorced" },
  { value: "widowed", label: "Widowed" },
]
