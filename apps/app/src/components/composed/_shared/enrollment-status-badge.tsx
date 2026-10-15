import { Badge } from "@workspace/ui/components/badge"

import type { ContractEnrollmentStatus } from "@workspace/contracts/domain"

/** The canonical enrollment-funnel badge — one label set for the same
 *  status everywhere (learner dashboard, manager roster, reports). */

export const ENROLLMENT_STATUS: Record<
  ContractEnrollmentStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  registered: { label: "Terdaftar", variant: "secondary" },
  selected: { label: "Peserta", variant: "default" },
  failed: { label: "Tidak Lulus", variant: "destructive" },
  graduated: { label: "Lulus", variant: "default" },
  canceled: { label: "Dibatalkan", variant: "outline" },
}

export function EnrollmentStatusBadge({ status }: { status: ContractEnrollmentStatus }) {
  const config = ENROLLMENT_STATUS[status] ?? ENROLLMENT_STATUS.registered
  return <Badge variant={config.variant}>{config.label}</Badge>
}
