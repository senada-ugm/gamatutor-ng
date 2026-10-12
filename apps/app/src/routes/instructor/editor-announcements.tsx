import { AnnouncementManager } from "@/components/composed/announcements/announcement-manager"
import { useEditorCourse } from "@/routes/instructor/editor"

export function EditorAnnouncementsTab() {
  const course = useEditorCourse()
  return <AnnouncementManager courseId={course.id} />
}
