import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { UseMutationResult } from "@tanstack/react-query"
import { toast } from "sonner"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select"
import { Textarea } from "@workspace/ui/components/textarea"

import { apiSend } from "@/lib/api"
import { EmptyState } from "@/components/composed/_shared/empty-state"
import { useConfirm } from "@/components/composed/_shared/confirm-dialog"
import type { ContractLesson, ContractModule } from "@workspace/contracts/domain"

/**
 * Konten tab: module/lesson authoring against the real course-content
 * API. The player reads whatever lands here, so this is the authoring
 * half of the loop the smoke tests verify end to end.
 */

export function ContentEditor({ courseId, modules }: { courseId: string; modules: ContractModule[] }) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [showAddModule, setShowAddModule] = useState(false)

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["course", courseId] })
  }

  const addModule = useMutation({
    mutationFn: (values: { title: string; description: string }) =>
      apiSend<ContractModule>("POST", `/courses/${courseId}/modules`, {
        title: values.title,
        description: values.description || undefined,
      }),
    onSuccess: () => {
      toast.success("Modul ditambahkan")
      setShowAddModule(false)
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menambah modul"),
  })

  const deleteModule = useMutation({
    mutationFn: (moduleId: string) => apiSend<null>("DELETE", `/modules/${moduleId}`),
    onSuccess: () => {
      toast.success("Modul dihapus")
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menghapus modul"),
  })

  if (modules.length === 0 && !showAddModule) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Konten Pelatihan</h2>
          <Button onClick={() => setShowAddModule(true)}>+ Tambah Modul</Button>
        </div>
        <EmptyState
          title="Belum ada modul"
          description="Tambahkan modul pertama untuk mulai membangun pelatihan Anda."
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Konten Pelatihan</h2>
        <Button onClick={() => setShowAddModule((v) => !v)}>+ Tambah Modul</Button>
      </div>

      {showAddModule ? (
        <ModuleForm
          submitting={addModule.isPending}
          onSubmit={(values) => addModule.mutate(values)}
          onCancel={() => setShowAddModule(false)}
        />
      ) : null}

      <div className="space-y-3">
        {modules.map((module, index) => (
          <ModuleSection
            key={module.id}
            module={module}
            index={index}
            courseId={courseId}
            onDeleteModule={() => {
              void confirm({
                title: "Hapus modul?",
                description: `"${module.title}" beserta seluruh materinya akan dihapus permanen.`,
                confirmLabel: "Hapus",
                destructive: true,
              }).then((ok) => {
                if (ok) deleteModule.mutate(module.id)
              })
            }}
          />
        ))}
      </div>
    </div>
  )
}

function ModuleSection({
  module,
  index,
  courseId,
  onDeleteModule,
}: {
  module: ContractModule
  index: number
  courseId: string
  onDeleteModule: () => void
}) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [showAddLesson, setShowAddLesson] = useState(false)
  const [editingLesson, setEditingLesson] = useState<ContractLesson | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [moduleTitle, setModuleTitle] = useState(module.title)

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["course", courseId] })
  }

  function run<TSuccess, TInput>(
    mutation: UseMutationResult<TSuccess, Error, TInput>,
    input: TInput,
    successMessage: string
  ) {
    mutation.mutate(input, {
      onSuccess: () => {
        toast.success(successMessage)
        invalidate()
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Operasi gagal"),
    })
  }

  const addLesson = useMutation({
    mutationFn: (values: LessonFormValues) =>
      apiSend<ContractLesson>("POST", `/modules/${module.id}/lessons`, toLessonPayload(values)),
  })
  const updateLesson = useMutation({
    mutationFn: (lesson: { id: string; values: LessonFormValues }) =>
      apiSend<ContractLesson>("PATCH", `/lessons/${lesson.id}`, toLessonPayload(lesson.values)),
  })
  const deleteLesson = useMutation({
    mutationFn: (lessonId: string) => apiSend<null>("DELETE", `/lessons/${lessonId}`),
  })
  const renameModule = useMutation({
    mutationFn: (title: string) => apiSend<ContractModule>("PATCH", `/modules/${module.id}`, { title }),
    onSuccess: () => {
      toast.success("Modul diubah namanya")
      setRenaming(false)
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal mengubah nama modul"),
  })

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            {renaming ? (
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 w-56"
                  value={moduleTitle}
                  onChange={(e) => setModuleTitle(e.target.value)}
                  autoFocus
                />
                <Button
                  size="sm"
                  disabled={renameModule.isPending || !moduleTitle.trim()}
                  onClick={() => renameModule.mutate(moduleTitle.trim())}
                >
                  Simpan
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRenaming(false)}>
                  Batal
                </Button>
              </div>
            ) : (
              <h3 className="font-medium">
                {index + 1}. {module.title}
              </h3>
            )}
            <p className="text-xs text-muted-foreground">{module.lessons.length} materi</p>
          </div>
          <div className="flex shrink-0 gap-2">
            {!renaming ? (
              <Button size="sm" variant="ghost" onClick={() => setRenaming(true)}>
                Ubah Nama
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => setShowAddLesson((v) => !v)}>
              + Tambah Materi
            </Button>
            <Button size="sm" variant="ghost" onClick={onDeleteModule}>
              Hapus Modul
            </Button>
          </div>
        </div>

        {showAddLesson ? (
          <LessonForm
            submitting={addLesson.isPending}
            onSubmit={(values) => {
              run(addLesson, values, "Materi ditambahkan")
              setShowAddLesson(false)
            }}
            onCancel={() => setShowAddLesson(false)}
          />
        ) : null}
        {editingLesson ? (
          <LessonForm
            initial={lessonFormValuesFromLesson(editingLesson)}
            submitting={updateLesson.isPending}
            onSubmit={(values) => {
              run(updateLesson, { id: editingLesson.id, values }, "Materi disimpan")
              setEditingLesson(null)
            }}
            onCancel={() => setEditingLesson(null)}
          />
        ) : null}

        {module.lessons.length === 0 ? (
          <EmptyState compact title="Belum ada materi" description="Tambahkan materi pertama untuk modul ini." />
        ) : (
          <ul className="divide-y divide-border rounded-lg border">
            {module.lessons.map((lesson) => (
              <li key={lesson.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{lesson.title}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">
                      {lesson.contentType === "video"
                        ? "Video"
                        : lesson.contentType === "audio"
                          ? "Audio"
                          : lesson.contentType === "text"
                            ? "Teks"
                            : "Dokumen"}
                    </Badge>
                    {lesson.isPreview ? <span>Pratinjau publik</span> : null}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditingLesson(lesson)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      void confirm({
                        title: "Hapus materi?",
                        description: `"${lesson.title}" akan dihapus permanen.`,
                        confirmLabel: "Hapus",
                        destructive: true,
                      }).then((ok) => {
                        if (ok) run(deleteLesson, lesson.id, "Materi dihapus")
                      })
                    }}
                  >
                    Hapus
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function ModuleForm({
  submitting,
  onSubmit,
  onCancel,
}: {
  submitting: boolean
  onSubmit: (values: { title: string; description: string }) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="module-title">Judul Modul</Label>
          <Input id="module-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="module-description">Deskripsi (opsional)</Label>
          <Input id="module-description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button size="sm" disabled={submitting || !title.trim()} onClick={() => onSubmit({ title, description })}>
            {submitting ? "Menyimpan..." : "Tambah Modul"}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            Batal
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export interface LessonFormValues {
  title: string
  description: string
  contentType: "text" | "video" | "audio" | "document"
  textContent: string
  url: string
  duration: string
  isPreview: boolean
}

function lessonFormValuesFromLesson(lesson: ContractLesson): LessonFormValues {
  return {
    title: lesson.title,
    description: lesson.description ?? "",
    contentType: lesson.contentType ?? "text",
    textContent: lesson.textContent ?? "",
    url: lesson.url ?? "",
    duration: lesson.duration != null ? String(lesson.duration) : "",
    isPreview: lesson.isPreview ?? false,
  }
}

function toLessonPayload(values: LessonFormValues) {
  return {
    title: values.title,
    description: values.description || undefined,
    contentType: values.contentType,
    textContent: values.textContent || undefined,
    url: values.url || undefined,
    duration: values.duration ? Number(values.duration) : undefined,
    isPreview: values.isPreview,
  }
}

function LessonForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial?: LessonFormValues
  submitting: boolean
  onSubmit: (values: LessonFormValues) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState<LessonFormValues>(
    initial ?? {
      title: "",
      description: "",
      contentType: "text",
      textContent: "",
      url: "",
      duration: "",
      isPreview: false,
    }
  )

  function update<TKey extends keyof LessonFormValues>(key: TKey, value: LessonFormValues[TKey]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-3 border-t pt-3">
      <div className="space-y-1.5">
        <Label htmlFor="lesson-title">Judul Materi</Label>
        <Input id="lesson-title" value={values.title} onChange={(e) => update("title", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lesson-description">Deskripsi (opsional)</Label>
        <Input
          id="lesson-description"
          value={values.description}
          onChange={(e) => update("description", e.target.value)}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="lesson-type">Jenis Konten</Label>
          <NativeSelect
            id="lesson-type"
            className="w-full"
            value={values.contentType}
            onChange={(e) => update("contentType", e.target.value as LessonFormValues["contentType"])}
          >
            <NativeSelectOption value="text">Teks</NativeSelectOption>
            <NativeSelectOption value="video">Video</NativeSelectOption>
            <NativeSelectOption value="audio">Audio</NativeSelectOption>
            <NativeSelectOption value="document">Dokumen</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lesson-duration">Durasi (menit, opsional)</Label>
          <Input
            id="lesson-duration"
            type="number"
            min={0}
            value={values.duration}
            onChange={(e) => update("duration", e.target.value)}
          />
        </div>
      </div>
      {values.contentType === "text" ? (
        <div className="space-y-1.5">
          <Label htmlFor="lesson-text">Konten Teks</Label>
          <Textarea
            id="lesson-text"
            rows={5}
            value={values.textContent}
            onChange={(e) => update("textContent", e.target.value)}
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="lesson-url">URL {values.contentType === "video" ? "Video" : "Dokumen"}</Label>
          <Input
            id="lesson-url"
            value={values.url}
            onChange={(e) => update("url", e.target.value)}
            placeholder="https://..."
          />
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={values.isPreview} onCheckedChange={(checked) => update("isPreview", checked === true)} />
        Bisa dipratinjau tanpa mendaftar
      </label>
      <div className="flex gap-2">
        <Button size="sm" disabled={submitting || !values.title.trim()} onClick={() => onSubmit(values)}>
          {submitting ? "Menyimpan..." : "Simpan Materi"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Batal
        </Button>
      </div>
    </div>
  )
}
