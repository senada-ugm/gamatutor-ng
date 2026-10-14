import { ParticipantsPanel } from "@/components/composed/courses/participants-panel"
import { useEditorCourse } from "@/routes/instructor/editor"

export function EditorParticipantsTab() {
  const course = useEditorCourse()
  return <ParticipantsPanel courseId={course.id} coursePrice={course.price} />
}
