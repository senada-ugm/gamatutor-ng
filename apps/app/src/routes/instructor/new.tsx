import { useNavigate } from "@tanstack/react-router"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"

import { Skeleton } from "@workspace/ui/components/skeleton"

import { EmptyState } from "@/components/composed/_shared/empty-state"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { CourseForm, toCourseWritePayload } from "@/components/composed/courses/course-form"
import type { CourseFormValues } from "@/components/composed/courses/course-form"
import { useAuthoringScope } from "@/lib/authoring-institution"
import { apiSend } from "@/lib/api"
import type { ContractCourse } from "@workspace/contracts/domain"

/**
 * Course creation, scoped to an institution the caller actually chose.
 * This page used to take `ownerships[0]` — for an account owning more
 * than one institution (which the schema has always allowed) that meant
 * the course landed wherever the API's row order put it, with nothing on
 * screen naming the target. The scope is now stated on the page and the
 * form doesn't submit without one.
 */
export function NewCoursePage() {
  const navigate = useNavigate()
  const scope = useAuthoringScope()

  // An admin's default scope is the platform-wide listing view, which is
  // not a place a course can be created — they pick a real institution
  // first. Owners always resolve to one of their own.
  const target = scope.institution

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
        backLabel="Kelola Pelatihan"
        title="Buat Pelatihan"
        description="Pelatihan baru dimulai sebagai draf — terbitkan setelah kontennya siap."
      />

      {scope.isLoading ? (
        <Skeleton className="h-96 w-full max-w-3xl" />
      ) : scope.isError ? (
        <ErrorState error={scope.error} onRetry={scope.refetch} />
      ) : scope.institutions.length === 0 ? (
        <EmptyState
          title="Belum ada institusi"
          description="Ajukan institusi terlebih dahulu untuk membuat pelatihan."
        />
      ) : !target ? (
        <EmptyState
          title="Pilih institusi"
          description="Pelatihan dibuat di bawah satu institusi — pilih salah satu di panel samping untuk melanjutkan."
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
