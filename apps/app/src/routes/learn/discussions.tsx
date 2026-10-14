import { Link, useNavigate, useParams } from "@tanstack/react-router"
import { Fragment, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
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
import { Textarea } from "@workspace/ui/components/textarea"

import { useSession } from "@/lib/session"
import { BackLink } from "@/components/composed/_shared/back-link"
import { EmptyState } from "@/components/composed/_shared/empty-state"
import { Pager } from "@/components/composed/_shared/pager"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { useConfirm } from "@/components/composed/_shared/confirm-dialog"
import { CreateDiscussionCard } from "@/components/composed/discussions/create-discussion-card"
import { buildReplyTree, DiscussionReplyNode } from "@/components/composed/discussions/discussion-reply-node"
import { apiGet, apiGetPaged, apiSend } from "@/lib/api"
import { formatCourseDate } from "@/lib/lms-date"
import type { ContractDiscussion, ContractDiscussionDetail, ContractDiscussionReply } from "@workspace/contracts/domain"

export function DiscussionBoardPage() {
  const { courseId } = useParams({ from: "/learn/$courseId/discussions" })
  const [includeResolved, setIncludeResolved] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 15

  const discussions = useQuery({
    queryKey: ["discussions", courseId, page],
    queryFn: () =>
      apiGetPaged<ContractDiscussion>(`/courses/${courseId}/discussions?page=${page}&pageSize=${pageSize}`),
  })

  const rows = discussions.data?.data ?? []
  const totalPages = discussions.data?.pagination.totalPages ?? 1
  const visible = includeResolved ? rows : rows.filter((d) => !d.isResolved)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Diskusi" />
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={includeResolved} onCheckedChange={(checked) => setIncludeResolved(checked === true)} />
            Tampilkan yang selesai
          </label>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            Diskusi Baru
          </Button>
        </div>
      </div>

      {showForm ? <CreateDiscussionCard courseId={courseId} onDone={() => setShowForm(false)} /> : null}

      {discussions.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : visible.length === 0 ? (
        <EmptyState title="Belum ada diskusi" description="Jadilah yang pertama memulai diskusi di pelatihan ini." />
      ) : (
        <div className="space-y-4">
          <ItemGroup>
            {visible.map((discussion, index) => (
              <Fragment key={discussion.id}>
                {index > 0 ? <ItemSeparator /> : null}
                <Item
                  render={
                    <Link
                      to="/learn/$courseId/discussions/$discussionId"
                      params={{ courseId, discussionId: discussion.id }}
                      aria-label={discussion.title}
                    />
                  }
                >
                  <ItemMedia>
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs font-medium">
                        {(discussion.user.name || discussion.user.email).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{discussion.title}</ItemTitle>
                    <ItemDescription className="line-clamp-1 text-xs">
                      {discussion.user.name || discussion.user.email} · {discussion.replyCount} balasan ·{" "}
                      {discussion.viewCount} dilihat ·{" "}
                      {formatCourseDate(discussion.createdAt, {
                        full: false,
                        dateOnly: true,
                      })}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    {discussion.isPinned ? <Badge variant="secondary">Disemat</Badge> : null}
                    {discussion.isResolved ? <Badge variant="outline">Selesai</Badge> : null}
                    {discussion.isClosed ? <Badge variant="outline">Ditutup</Badge> : null}
                  </ItemActions>
                </Item>
              </Fragment>
            ))}
          </ItemGroup>

          <Pager page={page} totalPages={totalPages} disabled={discussions.isFetching} onPageChange={setPage} />
        </div>
      )}
    </div>
  )
}

export function DiscussionThreadPage() {
  const { courseId, discussionId } = useParams({
    from: "/learn/$courseId/discussions/$discussionId",
  })
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const session = useSession()
  const currentUser = session.data ?? null
  const [replyContent, setReplyContent] = useState("")
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  const discussion = useQuery({
    queryKey: ["discussion", discussionId],
    queryFn: () => apiGet<ContractDiscussionDetail>(`/discussions/${discussionId}`),
  })

  // Managers: admins, the course's institution owner, or an assigned
  // course-instructor — mirrors the API's assertCanManageCourse. The
  // author additionally gets resolve/unresolve (API allows author or
  // manager) but never pin/close.
  const ownedInstitutionIds = useQuery({
    queryKey: ["owned-institutions", currentUser?.id],
    queryFn: () =>
      apiGet<Array<{ institutionId: string }>>(`/institution-ownerships?userId=${currentUser?.id}&pageSize=100`),
    enabled: currentUser != null,
    select: (rows) => new Set(rows.map((r) => r.institutionId)),
  })
  const myAssignments = useQuery({
    queryKey: ["course-instructors-mine", currentUser?.id],
    queryFn: () => apiGet<Array<{ courseId: string }>>(`/course-instructors/mine?pageSize=100`),
    enabled: currentUser != null,
    select: (rows) => new Set(rows.map((r) => r.courseId)),
  })
  const canManage =
    currentUser?.role === "admin" ||
    ownedInstitutionIds.data?.has(courseId) === true ||
    myAssignments.data?.has(courseId) === true
  // The API's assertCanModerateOrOwn: a manager, or the thread's own
  // author. Gates resolve and delete; pin/close stay manager-only.
  const canModerateOrOwn = discussion.data?.user.id === currentUser?.id || canManage

  function invalidate() {
    void queryClient.invalidateQueries({
      queryKey: ["discussion", discussionId],
    })
  }

  const reply = useMutation({
    mutationFn: (parentReplyId?: string) =>
      apiSend<ContractDiscussionReply>("POST", `/discussions/${discussionId}/replies`, {
        content: replyContent.trim(),
        parentReplyId,
      }),
    onSuccess: () => {
      setReplyContent("")
      setReplyingTo(null)
      toast.success("Balasan terkirim")
      invalidate()
    },
    onError: () => toast.error("Gagal mengirim balasan"),
  })

  const deleteDiscussion = useMutation({
    mutationFn: () => apiSend<null>("DELETE", `/discussions/${discussionId}`),
    onSuccess: () => {
      toast.success("Diskusi dihapus")
      void queryClient.invalidateQueries({ queryKey: ["discussions", courseId] })
      void navigate({ to: "/learn/$courseId/discussions", params: { courseId } })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menghapus diskusi"),
  })

  const deleteReply = useMutation({
    mutationFn: (replyId: string) => apiSend<null>("DELETE", `/discussions/${discussionId}/replies/${replyId}`),
    onSuccess: () => {
      toast.success("Balasan dihapus")
      invalidate()
    },
    onError: () => toast.error("Gagal menghapus balasan"),
  })

  const moderation = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string
      action: "pin" | "unpin" | "close" | "reopen" | "resolve" | "unresolve"
    }) => apiSend<ContractDiscussion>("POST", `/discussions/${id}/${action}`),
    onSuccess: () => invalidate(),
    onError: () => toast.error("Gagal memperbarui diskusi"),
  })

  if (discussion.isLoading) {
    return <Skeleton className="h-64 w-full" />
  }
  if (!discussion.data) {
    return (
      <div className="space-y-4">
        <BackLink to="/learn/$courseId/discussions" params={{ courseId }} label="Kembali ke Diskusi" />
        <p className="py-8 text-center text-muted-foreground">Diskusi tidak ditemukan.</p>
      </div>
    )
  }

  const d = discussion.data

  function handleSubmitReply(parentReplyId?: string) {
    if (!replyContent.trim() || reply.isPending) return
    reply.mutate(parentReplyId)
  }

  function handleDeleteReply(replyId: string) {
    void confirm({
      title: "Hapus balasan?",
      description: "Balasan ini akan dihapus permanen dari diskusi.",
      confirmLabel: "Hapus",
      destructive: true,
    }).then((ok) => {
      if (ok) deleteReply.mutate(replyId)
    })
  }

  const replyTree = buildReplyTree(d.replies)

  return (
    <div className="space-y-5">
      <PageHeader
        backTo="/learn/$courseId/discussions"
        backParams={{ courseId }}
        backLabel="Kembali ke Diskusi"
        title={d.title}
      />

      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              {(d.isPinned || d.isResolved || d.isClosed) && (
                <div className="flex flex-wrap gap-1.5">
                  {d.isPinned ? <Badge variant="secondary">Disemat</Badge> : null}
                  {d.isResolved ? <Badge variant="outline">Diselesaikan</Badge> : null}
                  {d.isClosed ? <Badge variant="outline">Ditutup</Badge> : null}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{d.user.name || d.user.email}</span>
                <span>
                  {formatCourseDate(d.createdAt, {
                    full: false,
                    dateOnly: true,
                  })}
                </span>
                <span>{d.viewCount} dilihat</span>
                <span>{d.replyCount} balasan</span>
              </div>
            </div>

            {canModerateOrOwn ? (
              <div className="flex shrink-0 flex-wrap gap-2">
                {canManage ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={moderation.isPending}
                      onClick={() =>
                        moderation.mutate({
                          id: d.id,
                          action: d.isPinned ? "unpin" : "pin",
                        })
                      }
                    >
                      {d.isPinned ? "Lepas Semat" : "Semat"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={moderation.isPending}
                      onClick={() =>
                        moderation.mutate({
                          id: d.id,
                          action: d.isClosed ? "reopen" : "close",
                        })
                      }
                    >
                      {d.isClosed ? "Buka Kembali" : "Tutup"}
                    </Button>
                  </>
                ) : null}
                {canModerateOrOwn ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={moderation.isPending}
                    onClick={() =>
                      moderation.mutate({
                        id: d.id,
                        action: d.isResolved ? "unresolve" : "resolve",
                      })
                    }
                  >
                    {d.isResolved ? "Batalkan Penyelesaian" : "Selesaikan"}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={deleteDiscussion.isPending}
                  onClick={() => {
                    void confirm({
                      title: "Hapus diskusi?",
                      description:
                        d.replyCount > 0
                          ? `"${d.title}" beserta ${d.replyCount} balasan akan dihapus permanen.`
                          : `"${d.title}" akan dihapus permanen.`,
                      confirmLabel: "Hapus",
                      destructive: true,
                    }).then((ok) => {
                      if (ok) deleteDiscussion.mutate()
                    })
                  }}
                >
                  Hapus
                </Button>
              </div>
            ) : null}
          </div>

          <p className="text-sm whitespace-pre-wrap text-foreground/80 sm:text-base">{d.content}</p>
        </CardContent>
      </Card>

      {!d.isClosed ? (
        <Card>
          <CardContent className="space-y-3">
            <h3 className="text-sm font-semibold">Tambah Balasan</h3>
            <Textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Tulis balasan Anda..."
              rows={4}
            />
            <Button onClick={() => handleSubmitReply()} disabled={reply.isPending || !replyContent.trim()}>
              {reply.isPending ? "Mengirim..." : "Kirim Balasan"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">Diskusi ditutup — balasan baru tidak diterima.</p>
      )}

      <div>
        <h3 className="mb-3 text-sm font-semibold">Balasan ({d.replyCount})</h3>
        {replyTree.length === 0 ? (
          <EmptyState title="Belum ada balasan" description="Jadilah yang pertama membalas!" />
        ) : (
          <Card>
            <CardContent>
              {replyTree.map((node) => (
                <DiscussionReplyNode
                  key={node.id}
                  node={node}
                  isClosed={d.isClosed}
                  replyingTo={replyingTo}
                  replyContent={replyContent}
                  isSubmittingReply={reply.isPending}
                  onSetReplyingTo={setReplyingTo}
                  onSetReplyContent={setReplyContent}
                  onSubmitReply={handleSubmitReply}
                  onDeleteReply={handleDeleteReply}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
