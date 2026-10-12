import { Fragment, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { Badge } from "@workspace/ui/components/badge"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@workspace/ui/components/item"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { EmptyState } from "@/components/composed/_shared/empty-state"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { SearchInput, useDebouncedValue } from "@/components/composed/_shared/search-input"
import { Pager } from "@/components/composed/_shared/pager"
import { apiGetPaged } from "@/lib/api"
import { formatCourseDate } from "@/lib/lms-date"
import type { ContractAuditLogEntry } from "@workspace/contracts/domain"

/** Admin audit trail: every privileged mutation, searchable. */

export function AdminAuditPage() {
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search)
  const [page, setPage] = useState(1)

  const entries = useQuery({
    queryKey: ["audit-log", debouncedSearch, page],
    queryFn: () =>
      apiGetPaged<ContractAuditLogEntry>(
        `/audit-log?search=${encodeURIComponent(debouncedSearch)}&page=${page}&pageSize=20`
      ),
  })

  const rows = entries.data?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Log Audit" description="Jejak setiap aksi administratif di platform." />

      <SearchInput
        label="Cari log audit"
        placeholder="Cari aksi, entitas, atau aktor…"
        value={search}
        onChange={(next) => {
          setSearch(next)
          setPage(1)
        }}
      />

      {entries.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : entries.isError ? (
        <ErrorState error={entries.error} onRetry={() => void entries.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="Tidak ada entri" description="Coba kata kunci lain." />
      ) : (
        <ItemGroup>
          {rows.map((entry, index) => (
            <Fragment key={entry.id}>
              {index > 0 ? <ItemSeparator /> : null}
              <Item>
                <ItemContent>
                  <ItemTitle>
                    <Badge variant="outline" className="font-mono text-xs">
                      {entry.action}
                    </Badge>
                    <span className="text-muted-foreground">
                      {entry.entityType}
                      {entry.entityId ? ` · ${entry.entityId}` : ""}
                    </span>
                  </ItemTitle>
                  <ItemDescription className="line-clamp-1 text-xs">
                    {formatCourseDate(entry.createdAt, { full: false })}
                    {entry.actorUserId ? ` · oleh ${entry.actorUserId}` : ""}
                  </ItemDescription>
                </ItemContent>
              </Item>
            </Fragment>
          ))}
        </ItemGroup>
      )}

      <Pager
        page={page}
        totalPages={entries.data?.pagination.totalPages ?? 1}
        disabled={entries.isFetching}
        onPageChange={setPage}
      />
    </div>
  )
}
