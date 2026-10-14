import { asc, desc, type AnyColumn, type SQL } from "drizzle-orm"

/**
 * Parses the contract's OrderByParam ("field:dir", default asc) against a
 * per-route allowlist of columns — unknown fields or directions fall back
 * to the route's default ordering, so the advertised parameter works
 * without becoming an injection surface.
 */
export function orderByClause(orderBy: string | undefined, allowed: Record<string, AnyColumn>, fallback: SQL): SQL {
  const [field, direction = "asc"] = (orderBy ?? "").split(":")
  const column = field ? allowed[field.trim()] : undefined
  if (!column) return fallback
  return direction.toLowerCase() === "desc" ? desc(column) : asc(column)
}
