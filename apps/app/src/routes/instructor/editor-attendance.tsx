import { AttendanceManager } from "@/components/composed/courses/attendance-manager"
import { useEditorCourse } from "@/routes/instructor/editor"

export function EditorAttendanceTab() {
  const course = useEditorCourse()
  return <AttendanceManager courseId={course.id} />
}
