import { cn } from "@workspace/ui/lib/utils"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@workspace/ui/components/pagination"

interface PagerProps {
  page: number
  totalPages: number
  disabled?: boolean
  onPageChange: (page: number) => void
}

/** The one pagination idiom for every list page — prev/next plus a
 *  "page X of Y" counter. Renders nothing when there's a single page. */
export function Pager({ page, totalPages, disabled, onPageChange }: PagerProps) {
  if (totalPages <= 1) return null

  const canPrev = page > 1 && !disabled
  const canNext = page < totalPages && !disabled

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            text="Sebelumnya"
            aria-disabled={!canPrev}
            className={cn(!canPrev && "pointer-events-none opacity-50")}
            onClick={() => canPrev && onPageChange(page - 1)}
          />
        </PaginationItem>
        <PaginationItem className="px-2 text-sm text-muted-foreground" aria-live="polite">
          Halaman {page} dari {totalPages}
        </PaginationItem>
        <PaginationItem>
          <PaginationNext
            text="Berikutnya"
            aria-disabled={!canNext}
            className={cn(!canNext && "pointer-events-none opacity-50")}
            onClick={() => canNext && onPageChange(page + 1)}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
