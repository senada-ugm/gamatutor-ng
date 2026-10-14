import { useRef, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select"
import { Textarea } from "@workspace/ui/components/textarea"

import { CourseThumbnail } from "./_atoms/course-thumbnail"
import { formatFileSize } from "@/lib/lms-date"
import { uploadFile } from "@/lib/uploads"
import type { ContractCourse } from "@workspace/contracts/domain"

/**
 * Lean course write form covering the fields a course author actually
 * needs day-to-day (identity, type, level, price, capacity). Contract
 * exotics (funding source, contact person, city, …) stay server-defaulted
 * until a surface needs them — collecting them here without a consumer
 * would just be noise.
 */

const COURSE_TYPES = [
  { value: "online", label: "Online" },
  { value: "offline", label: "Tatap Muka" },
  { value: "hybrid", label: "Hybrid" },
] as const

const LEVELS = [
  { value: "beginner", label: "Pemula" },
  { value: "intermediate", label: "Menengah" },
  { value: "advanced", label: "Lanjutan" },
  { value: "expert", label: "Ahli" },
] as const

const MAX_THUMBNAIL_BYTES = 10 * 1024 * 1024

export interface CourseFormValues {
  title: string
  shortDescription: string
  description: string
  thumbnail: string
  courseType: (typeof COURSE_TYPES)[number]["value"]
  level: (typeof LEVELS)[number]["value"]
  price: string
  participantQuota: string
}

export function courseFormValuesFromCourse(course: ContractCourse): CourseFormValues {
  return {
    title: course.title,
    shortDescription: course.shortDescription ?? "",
    description: course.description ?? "",
    thumbnail: course.thumbnail ?? "",
    courseType: course.courseType,
    level: course.level ?? "beginner",
    price: course.price != null ? String(course.price) : "",
    participantQuota: course.participantQuota != null ? String(course.participantQuota) : "",
  }
}

export function toCourseWritePayload(values: CourseFormValues) {
  return {
    title: values.title,
    shortDescription: values.shortDescription || undefined,
    description: values.description || undefined,
    thumbnail: values.thumbnail || null,
    courseType: values.courseType,
    level: values.level,
    price: values.price ? Number(values.price) : undefined,
    participantQuota: values.participantQuota ? Number(values.participantQuota) : undefined,
    isDisabilityFriendly: false,
    supportedDisabilityTypes: [],
  }
}

export function CourseForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
}: {
  initial?: CourseFormValues
  submitLabel: string
  submitting?: boolean
  onSubmit: (values: CourseFormValues) => void
}) {
  const [values, setValues] = useState<CourseFormValues>(
    initial ?? {
      title: "",
      shortDescription: "",
      description: "",
      thumbnail: "",
      courseType: "online",
      level: "beginner",
      price: "",
      participantQuota: "",
    }
  )
  const [error, setError] = useState<string | null>(null)
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)
  const thumbnailInputRef = useRef<HTMLInputElement>(null)

  function update<TKey extends keyof CourseFormValues>(key: TKey, value: CourseFormValues[TKey]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function handleThumbnailFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("Gambar sampul harus berupa file gambar.")
      return
    }
    if (file.size > MAX_THUMBNAIL_BYTES) {
      setError(`Gambar sampul melebihi ukuran maksimum ${formatFileSize(MAX_THUMBNAIL_BYTES)}.`)
      return
    }
    setError(null)
    setUploadingThumbnail(true)
    uploadFile(file, "thumbnail")
      .promise.then((uploaded) => update("thumbnail", uploaded.url))
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal mengunggah gambar sampul."))
      .finally(() => setUploadingThumbnail(false))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.title.trim()) {
      setError("Judul pelatihan wajib diisi.")
      return
    }
    setError(null)
    onSubmit(values)
  }

  return (
    <Card className="max-w-3xl">
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="thumbnail">Gambar Sampul</Label>
            <div className="flex items-center gap-3">
              <CourseThumbnail thumbnail={values.thumbnail} className="aspect-video w-28 shrink-0 rounded-lg border" />
              <div className="flex flex-col items-start gap-2">
                <input
                  ref={thumbnailInputRef}
                  id="thumbnail"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleThumbnailFile(e.target.files?.[0])}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingThumbnail}
                    onClick={() => thumbnailInputRef.current?.click()}
                  >
                    {uploadingThumbnail ? "Mengunggah..." : values.thumbnail ? "Ganti Gambar" : "Unggah Gambar"}
                  </Button>
                  {values.thumbnail ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => update("thumbnail", "")}>
                      Hapus
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Rasio 16:9 disarankan, maks {formatFileSize(MAX_THUMBNAIL_BYTES)}.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">Judul Pelatihan</Label>
            <Input
              id="title"
              value={values.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="cth: Pelatihan Digital Marketing Dasar"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="shortDescription">Deskripsi Singkat</Label>
            <Input
              id="shortDescription"
              value={values.shortDescription}
              onChange={(e) => update("shortDescription", e.target.value)}
              placeholder="Satu kalimat untuk katalog dan kartu pelatihan"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Deskripsi Lengkap</Label>
            <Textarea
              id="description"
              rows={5}
              value={values.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="courseType">Jenis Pelatihan</Label>
              <NativeSelect
                id="courseType"
                className="w-full"
                value={values.courseType}
                onChange={(e) => update("courseType", e.target.value as CourseFormValues["courseType"])}
              >
                {COURSE_TYPES.map((t) => (
                  <NativeSelectOption key={t.value} value={t.value}>
                    {t.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="level">Level</Label>
              <NativeSelect
                id="level"
                className="w-full"
                value={values.level}
                onChange={(e) => update("level", e.target.value as CourseFormValues["level"])}
              >
                {LEVELS.map((l) => (
                  <NativeSelectOption key={l.value} value={l.value}>
                    {l.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="price">Harga (Rupiah)</Label>
              <Input
                id="price"
                type="number"
                min={0}
                value={values.price}
                onChange={(e) => update("price", e.target.value)}
                placeholder="Kosongkan jika gratis"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="participantQuota">Kuota Peserta</Label>
              <Input
                id="participantQuota"
                type="number"
                min={0}
                value={values.participantQuota}
                onChange={(e) => update("participantQuota", e.target.value)}
                placeholder="cth: 30"
              />
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Menyimpan..." : submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
