import { CourseReportPanel } from "@/components/composed/courses/course-report-panel"
import { useEditorCourse } from "@/routes/instructor/editor"

export function EditorReportTab() {
  const course = useEditorCourse()
  return <CourseReportPanel courseId={course.id} />
}
