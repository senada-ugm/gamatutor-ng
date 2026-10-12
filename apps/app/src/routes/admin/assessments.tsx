import { PageHeader } from "@/components/composed/_shared/page-header"
import { QuizManager } from "@/components/composed/courses/quiz-manager"

/**
 * Platform-wide assessments — course-less quizzes such as RIASEC.
 * `AssessmentsApi.create` is admin-only, which is why this lives in the
 * management sidebar's Platform group rather than beside a course.
 * The authoring surface is the same QuizManager the course editor's Kuis
 * tab uses, pointed at /assessments instead of /courses/{id}/quizzes.
 */
export function AdminAssessmentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Asesmen" description="Tes minat dan gaya belajar yang berlaku lintas pelatihan." />
      <QuizManager scope={{ kind: "assessment" }} />
    </div>
  )
}
