/**
 * Indonesian-locale date helpers used across the player surfaces.
 * Render-time computations only (no live-ticking countdowns).
 */

export type CourseDate = Date | string | null | undefined

export function formatCourseDate(date: CourseDate, options: { dateOnly?: boolean; full?: boolean } = {}): string {
  const { dateOnly = false, full = true } = options
  if (!date) return ""

  const d = typeof date === "string" ? new Date(date) : date
  if (!(d instanceof Date) || isNaN(d.getTime())) return ""

  if (dateOnly) {
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" })
  }

  if (full) {
    return d.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function isCourseDatePast(date: CourseDate): boolean {
  if (!date) return false
  const d = typeof date === "string" ? new Date(date) : date
  return d < new Date()
}

/** A relative due-date phrase ("5 hari lagi", "Terlambat 2 hari"). */
export function formatRelativeDueDate(date: CourseDate): string {
  if (!date) return ""
  const d = typeof date === "string" ? new Date(date) : date
  if (!(d instanceof Date) || isNaN(d.getTime())) return ""

  const diffDays = Math.round((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  if (diffDays === 0) return "Hari ini"
  if (diffDays === 1) return "Besok"
  if (diffDays > 1) return `${diffDays} hari lagi`
  if (diffDays === -1) return "Terlambat 1 hari"
  return `Terlambat ${Math.abs(diffDays)} hari`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * An ISO instant as the local wall-clock string `<input type="datetime-local">`
 * wants (`YYYY-MM-DDTHH:mm`).
 *
 * `toISOString().slice(0, 16)` is the obvious version and it is wrong: the
 * input has no timezone, so feeding it UTC makes an 18:00 WIB deadline
 * display as 11:00 and silently save as 11:00 WIB the moment the form is
 * submitted. Subtracting the offset first keeps the round trip honest —
 * the submit side already reads the input back with `new Date(value)`,
 * which interprets it as local.
 */
export function toDateTimeLocalValue(date: CourseDate): string {
  if (!date) return ""
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return ""
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}
