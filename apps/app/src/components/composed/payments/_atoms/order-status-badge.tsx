import { Badge } from "@workspace/ui/components/badge"

import type { ContractOrder } from "@workspace/contracts/domain"

const STATUS_CONFIG: Record<
  ContractOrder["status"],
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  pending: { label: "Menunggu Pembayaran", variant: "secondary" },
  paid: { label: "Lunas", variant: "default" },
  canceled: { label: "Dibatalkan", variant: "outline" },
  refunded: { label: "Dikembalikan", variant: "destructive" },
}

export function OrderStatusBadge({ status }: { status: ContractOrder["status"] }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return <Badge variant={config.variant}>{config.label}</Badge>
}
