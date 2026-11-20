import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { MessageSquarePlus, Star } from "lucide-react"
import { toast } from "sonner"
import type { CourseReview, CourseReviewSummary, CourseReviewUpsert } from "@workspace/contracts"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { apiGet, apiGetPaged, apiSend } from "@/lib/api"
import { useSession } from "@/lib/session"
import { cn } from "@workspace/ui/lib/utils"

interface CourseReviewsSectionProps {
  courseId: string
  compact?: boolean
}

function StarDisplay({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const iconClass = size === "md" ? "size-5" : "size-4"
  return (
    <div className="flex items-center gap-0.5" aria-label={`Rating ${rating} dari 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            iconClass,
            star <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  )
}

export function CourseReviewsSection({ courseId, compact = false }: CourseReviewsSectionProps) {
  const { data: user } = useSession()
  const queryClient = useQueryClient()

  const summaryQuery = useQuery({
    queryKey: ["course-reviews-summary", courseId],
    queryFn: () => apiGet<CourseReviewSummary>(`/courses/${courseId}/reviews/summary`),
    enabled: Boolean(courseId),
  })

  const listQuery = useQuery({
    queryKey: ["course-reviews-list", courseId],
    queryFn: () => apiGetPaged<CourseReview>(`/courses/${courseId}/reviews?page=1&pageSize=10`),
    enabled: Boolean(courseId) && !compact,
  })

  const myReview = summaryQuery.data?.myReview
  const [rating, setRating] = useState<number>(myReview?.rating ?? 5)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [reviewText, setReviewText] = useState<string>(myReview?.review ?? "")
  const [suggestionText, setSuggestionText] = useState<string>(myReview?.suggestion ?? "")

  useEffect(() => {
    if (myReview) {
      setRating(myReview.rating)
      setReviewText(myReview.review ?? "")
      setSuggestionText(myReview.suggestion ?? "")
    }
  }, [myReview])

  const upsertMutation = useMutation({
    mutationFn: (payload: CourseReviewUpsert) =>
      apiSend<CourseReview>("PUT", `/courses/${courseId}/reviews/mine`, payload),
    onSuccess: () => {
      toast.success("Terima kasih! Rating, ulasan, dan saran Anda telah disimpan.")
      void queryClient.invalidateQueries({ queryKey: ["course-reviews-summary", courseId] })
      void queryClient.invalidateQueries({ queryKey: ["course-reviews-list", courseId] })
    },
    onError: (err: Error) => {
      toast.error(err.message || "Gagal menyimpan ulasan.")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (rating < 1 || rating > 5) {
      toast.error("Pilih rating bintang 1 sampai 5.")
      return
    }
    upsertMutation.mutate({
      rating,
      review: reviewText.trim() || undefined,
      suggestion: suggestionText.trim() || undefined,
    })
  }

  const summary = summaryQuery.data
  const reviews = listQuery.data?.data ?? []

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquarePlus className="size-4 text-primary" />
                Rating, Ulasan &amp; Saran Modul
              </CardTitle>
              <CardDescription>
                Bagikan pengalaman dan masukan Anda terkait modul yang telah dipelajari.
              </CardDescription>
            </div>
            {summary && summary.totalReviews > 0 && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5">
                <StarDisplay rating={summary.averageRating} />
                <span className="text-sm font-semibold">{summary.averageRating.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">({summary.totalReviews} ulasan)</span>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {user ? (
            <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-muted/20 p-4">
              <div className="space-y-1.5">
                <Label>Rating Modul</Label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = star <= (hoverRating || rating)
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="rounded p-1 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Beri ${star} bintang`}
                      >
                        <Star
                          className={cn(
                            "size-6 transition-colors",
                            active ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                          )}
                        />
                      </button>
                    )
                  })}
                  <span className="ml-2 text-xs text-muted-foreground">{rating} / 5</span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`course-review-${courseId}`}>Ulasan</Label>
                  <Textarea
                    id={`course-review-${courseId}`}
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="Bagaimana materi, alur belajar, atau kejelasan modul ini?"
                    rows={3}
                    maxLength={2000}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`course-suggestion-${courseId}`}>Saran Perbaikan</Label>
                  <Textarea
                    id={`course-suggestion-${courseId}`}
                    value={suggestionText}
                    onChange={(e) => setSuggestionText(e.target.value)}
                    placeholder="Ada saran untuk pengembangan modul ke depan?"
                    rows={3}
                    maxLength={2000}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={upsertMutation.isPending}>
                  {upsertMutation.isPending
                    ? "Menyimpan..."
                    : myReview
                      ? "Perbarui Ulasan & Saran"
                      : "Kirim Ulasan & Saran"}
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">Masuk ke akun Anda untuk memberikan rating, ulasan, dan saran.</p>
          )}

          {!compact && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Ulasan Peserta</h3>
              {reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada ulasan untuk pelatihan ini.</p>
              ) : (
                <div className="divide-y rounded-lg border">
                  {reviews.map((item) => (
                    <div key={item.id} className="space-y-1.5 p-3.5 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{item.userName}</span>
                        <div className="flex items-center gap-2">
                          <StarDisplay rating={item.rating} />
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.updatedAt).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                      {item.review && <p className="text-foreground/90">{item.review}</p>}
                      {item.suggestion && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground/80">Saran:</span> {item.suggestion}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
