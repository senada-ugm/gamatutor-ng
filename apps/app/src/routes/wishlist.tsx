import { Fragment, useState } from "react"
import { Link } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { CourseThumbnail } from "@/components/composed/courses/_atoms/course-thumbnail"
import { EmptyState } from "@/components/composed/_shared/empty-state"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { Pager } from "@/components/composed/_shared/pager"
import { apiGetPaged, apiSend } from "@/lib/api"
import type { ContractWishlistItem } from "@workspace/contracts/domain"

const PAGE_SIZE = 20

export function WishlistPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)

  const wishlist = useQuery({
    queryKey: ["wishlist", page],
    queryFn: () => apiGetPaged<ContractWishlistItem>(`/wishlist?page=${page}&pageSize=${PAGE_SIZE}`),
  })

  const remove = useMutation({
    mutationFn: (courseId: string) => apiSend<null>("DELETE", `/wishlist/${courseId}`),
    onSuccess: () => {
      toast.success("Dihapus dari wishlist")
      void queryClient.invalidateQueries({ queryKey: ["wishlist"] })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menghapus"),
  })

  const rows = wishlist.data?.data ?? []
  const total = wishlist.data?.pagination.totalCount

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wishlist"
        description={total === undefined ? "Pelatihan yang Anda simpan." : `${total} pelatihan disimpan.`}
      />

      {wishlist.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : wishlist.isError ? (
        <ErrorState error={wishlist.error} onRetry={() => void wishlist.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="Wishlist kosong" description="Simpan pelatihan menarik dari katalog untuk dilihat nanti." />
      ) : (
        <ItemGroup>
          {rows.map((item, index) => (
            <Fragment key={item.id}>
              {index > 0 ? <ItemSeparator /> : null}
              <Item>
                <ItemMedia variant="image" className="h-14 w-24 rounded-md">
                  <CourseThumbnail thumbnail={item.course?.thumbnail} />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{item.course?.title ?? item.courseId}</ItemTitle>
                  {item.course?.shortDescription ? (
                    <ItemDescription className="line-clamp-1">{item.course.shortDescription}</ItemDescription>
                  ) : null}
                </ItemContent>
                <ItemActions>
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<Link to="/courses/$courseId" params={{ courseId: item.courseId }} />}
                  >
                    Lihat
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    aria-label={`Hapus ${item.course?.title ?? "pelatihan"} dari wishlist`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(item.courseId)}
                  >
                    Hapus
                  </Button>
                </ItemActions>
              </Item>
            </Fragment>
          ))}
        </ItemGroup>
      )}

      <Pager
        page={page}
        totalPages={wishlist.data?.pagination.totalPages ?? 1}
        disabled={wishlist.isFetching}
        onPageChange={setPage}
      />
    </div>
  )
}
