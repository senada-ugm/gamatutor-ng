import { QuizManager } from "@/components/composed/courses/quiz-manager"
import { useEditorCourse } from "@/routes/instructor/editor"

export function EditorQuizzesTab() {
  const course = useEditorCourse()
  return <QuizManager scope={{ kind: "course", courseId: course.id }} />
}
