import { Badge } from "@workspace/ui/components/badge"

import type { ContractAssignmentSubmissionStatus } from "@workspace/contracts/domain"

const STATUS_CONFIG: Record<
  ContractAssignmentSubmissionStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  draft: { label: "Draf", variant: "secondary" },
  submitted: { label: "Dikumpulkan", variant: "default" },
  graded: { label: "Dinilai", variant: "outline" },
  returned: { label: "Dikembalikan", variant: "secondary" },
}

export function AssignmentSubmissionBadge({ status }: { status: ContractAssignmentSubmissionStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.submitted
  return <Badge variant={config.variant}>{config.label}</Badge>
}
