import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"

import { apiGet, apiSend } from "@/lib/api"

interface WishlistSummary {
  courseId: string
}

/** Toggle-style wishlist control backed by the real wishlist API. */
export function WishlistButton({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient()

  const wishlist = useQuery({
    queryKey: ["wishlist"],
    queryFn: () => apiGet<WishlistSummary[]>("/wishlist?pageSize=100"),
  })

  const wished = (wishlist.data ?? []).some((item) => item.courseId === courseId)

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["wishlist"] })
  }

  const toggle = useMutation({
    mutationFn: async () => {
      if (wished) {
        await apiSend<null>("DELETE", `/wishlist/${courseId}`)
      } else {
        await apiSend<unknown>("POST", "/wishlist", { courseId })
      }
    },
    onSuccess: () => {
      toast.success(wished ? "Dihapus dari wishlist" : "Disimpan ke wishlist")
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal memperbarui wishlist"),
  })

  return (
    <Button
      variant="outline"
      className="w-full"
      disabled={wishlist.isLoading || toggle.isPending}
      onClick={() => toggle.mutate()}
    >
      {wished ? "Hapus dari Wishlist" : "Simpan ke Wishlist"}
    </Button>
  )
}
