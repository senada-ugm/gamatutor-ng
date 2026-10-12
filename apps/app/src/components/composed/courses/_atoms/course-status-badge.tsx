import { Badge } from "@workspace/ui/components/badge"

import type { ContractCourseStatus } from "@workspace/contracts/domain"

const STATUS_CONFIG: Record<ContractCourseStatus, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Draf", variant: "secondary" },
  published: { label: "Diterbitkan", variant: "default" },
  archived: { label: "Diarsipkan", variant: "outline" },
  under_review: { label: "Dalam Peninjauan", variant: "secondary" },
}

export function CourseStatusBadge({ status }: { status: ContractCourseStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return <Badge variant={config.variant}>{config.label}</Badge>
}
