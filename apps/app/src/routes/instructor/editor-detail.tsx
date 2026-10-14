import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { CourseForm, courseFormValuesFromCourse, toCourseWritePayload } from "@/components/composed/courses/course-form"
import { useEditorCourse } from "@/routes/instructor/editor"
import { apiSend } from "@/lib/api"
import type { ContractCourse } from "@workspace/contracts/domain"

export function EditorDetailTab() {
  const course = useEditorCourse()
  const queryClient = useQueryClient()

  const update = useMutation({
    mutationFn: (values: ReturnType<typeof toCourseWritePayload>) =>
      apiSend<ContractCourse>("PATCH", `/courses/${course.id}`, values),
    onSuccess: () => {
      toast.success("Perubahan berhasil disimpan")
      void queryClient.invalidateQueries({ queryKey: ["course", course.id] })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menyimpan perubahan"),
  })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Detail Pelatihan</h2>
      <CourseForm
        initial={courseFormValuesFromCourse(course)}
        submitLabel="Simpan Perubahan"
        submitting={update.isPending}
        onSubmit={(values) => update.mutate(toCourseWritePayload(values))}
      />
    </div>
  )
}
