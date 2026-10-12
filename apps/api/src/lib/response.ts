import { randomBytes } from "node:crypto"
import type { CommonResponseMeta } from "@workspace/contracts"
import type { ContractDataResponse, ContractPagePagination, ContractPagedResponse } from "@workspace/contracts/domain"

export function createMeta(requestId: string): CommonResponseMeta {
  return {
    requestId,
    timestamp: new Date().toISOString(),
  }
}

export function dataResponse<T>(data: T, requestId: string): ContractDataResponse<T> {
  return { data, meta: createMeta(requestId) }
}

/**
 * Page-based pagination metadata with neutral link placeholders. Route
 * handlers that know their base URL can fill `links` afterwards.
 */
export function paginate<T>(
  items: T[],
  requestId: string,
  opts: { page: number; pageSize: number }
): ContractPagedResponse<T> {
  return pagedResponse(items, items.length, requestId, opts)
}

/** Same envelope as paginate(), for services that did LIMIT/OFFSET (and
 *  their own COUNT) in SQL — the total no longer equals items.length. */
export function pagedResponse<T>(
  items: T[],
  totalCount: number,
  requestId: string,
  opts: { page: number; pageSize: number }
): ContractPagedResponse<T> {
  const totalPages = Math.max(1, Math.ceil(totalCount / opts.pageSize))
  const pagination: ContractPagePagination = {
    page: opts.page,
    pageSize: opts.pageSize,
    totalCount,
    totalPages,
    hasNext: opts.page < totalPages,
    hasPrevious: opts.page > 1,
    links: { first: "", last: "" },
  }
  return { data: items, pagination, meta: createMeta(requestId) }
}

/** Hex-encoded crypto-random bytes, not Math.random() — these ids back
 *  session rows (auth.ts's Better Auth generateId), certificate
 *  verification codes, and attendance tokens, where a predictable id is
 *  a security hole. Hex keeps the id alphanumeric, which uploads' file
 *  route pattern (upl_[a-zA-Z0-9]+) requires. */
export function generateId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`
}
