import { ContentEditor } from "@/components/composed/courses/content-editor"
import { useEditorCourse } from "@/routes/instructor/editor"

export function EditorContentTab() {
  const course = useEditorCourse()
  return <ContentEditor courseId={course.id} modules={course.modules} />
}
