import { AssignmentManager } from "@/components/composed/courses/assignment-manager"
import { useEditorCourse } from "@/routes/instructor/editor"

export function EditorAssessmentsTab() {
  const course = useEditorCourse()
  return <AssignmentManager courseId={course.id} />
}
