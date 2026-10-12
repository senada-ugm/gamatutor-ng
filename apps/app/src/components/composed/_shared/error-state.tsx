import { Button } from "@workspace/ui/components/button"

import { EmptyState } from "@/components/composed/_shared/empty-state"

interface ErrorStateProps {
  /** The query error, used for its message when it carries one. */
  error?: unknown
  title?: string
  onRetry?: () => void
  compact?: boolean
  className?: string
}

/**
 * A failed fetch is not an empty list. Every list surface used to render
 * its EmptyState on error too, so "Belum ada notifikasi" was shown to a
 * user whose request had actually 500'd — an empty state that tells the
 * user a comforting lie and offers no way to retry. This says what
 * happened and offers the retry.
 */
export function ErrorState({
  error,
  title = "Gagal memuat data",
  onRetry,
  compact = false,
  className,
}: ErrorStateProps) {
  const message = error instanceof Error && error.message ? error.message : "Periksa koneksi Anda lalu coba lagi."

  return (
    <EmptyState
      title={title}
      description={message}
      compact={compact}
      className={className}
      action={
        onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Coba Lagi
          </Button>
        ) : null
      }
    />
  )
}
