import { useNavigate } from "@tanstack/react-router"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"

import { Skeleton } from "@workspace/ui/components/skeleton"

import { EmptyState } from "@/components/composed/_shared/empty-state"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { CourseForm, toCourseWritePayload } from "@/components/composed/courses/course-form"
import type { CourseFormValues } from "@/components/composed/courses/course-form"
import { useMyInstitution } from "@/lib/institution-ownership"
import { apiSend } from "@/lib/api"
import type { ContractCourse } from "@workspace/contracts/domain"

/**
 * Course creation, scoped to the account's resolved institution (the
 * single-tenant frontend's one tenant — PLANS Phase 5). The target is
 * still stated on the page and the form doesn't submit without one.
 */
export function NewCoursePage() {
  const navigate = useNavigate()
  const target = useMyInstitution()

  const create = useMutation({
    mutationFn: (values: CourseFormValues) => {
      if (!target) throw new Error("Pilih institusi terlebih dahulu")
      return apiSend<ContractCourse>("POST", "/courses", {
        ...toCourseWritePayload(values),
        institutionId: target.id,
      })
    },
    onSuccess: (course) => {
      toast.success(`Pelatihan dibuat di ${target?.name ?? "institusi Anda"}`)
      navigate({ to: "/instructor/courses/$courseId/editor", params: { courseId: course.id } })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal membuat pelatihan"),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        backTo="/instructor"
        backLabel="Pelatihan"
        title="Buat Pelatihan"
        description="Pelatihan baru dimulai sebagai draf — terbitkan setelah kontennya siap."
      />

      {target === undefined ? (
        <Skeleton className="h-96 w-full max-w-3xl" />
      ) : !target ? (
        <EmptyState
          title="Institusi belum tersedia"
          description="Pelatihan dibuat di bawah satu institusi — hubungi admin platform untuk mendapatkan akses."
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Dibuat di bawah <span className="font-medium text-foreground">{target.name}</span>.
          </p>
          <CourseForm
            submitLabel="Buat Pelatihan"
            submitting={create.isPending}
            onSubmit={(values) => create.mutate(values)}
          />
        </div>
      )}
    </div>
  )
}
