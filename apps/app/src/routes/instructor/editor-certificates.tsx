import { CertificateSettingsEditor } from "@/components/composed/courses/certificate-settings"
import { useEditorCourse } from "@/routes/instructor/editor"

export function EditorCertificatesTab() {
  const course = useEditorCourse()
  return <CertificateSettingsEditor courseId={course.id} />
}
