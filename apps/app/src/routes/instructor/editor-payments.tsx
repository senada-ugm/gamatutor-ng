import { CoursePaymentsPanel } from "@/components/composed/payments/course-payments-panel"
import { useEditorCourse } from "@/routes/instructor/editor"

export function EditorPaymentsTab() {
  const course = useEditorCourse()
  return <CoursePaymentsPanel courseId={course.id} coursePrice={course.price} />
}
