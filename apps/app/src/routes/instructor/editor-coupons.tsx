import { CouponManager } from "@/components/composed/payments/coupon-manager"
import { useEditorCourse } from "@/routes/instructor/editor"

export function EditorCouponsTab() {
  const course = useEditorCourse()
  return <CouponManager courseId={course.id} />
}
