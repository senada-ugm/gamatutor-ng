import { Fragment, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

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
  ItemSeparator,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Textarea } from "@workspace/ui/components/textarea"

import { EmptyState } from "@/components/composed/_shared/empty-state"
import { Pager } from "@/components/composed/_shared/pager"
import { useConfirm } from "@/components/composed/_shared/confirm-dialog"
import { apiGetPaged, apiSend } from "@/lib/api"
import { formatCourseDate } from "@/lib/lms-date"
import type { ContractAnnouncement } from "@workspace/contracts/domain"

/**
 * The course editor's Pengumuman tab: draft/publish/pin lifecycle for
 * course-wide announcements. Drafts stay invisible to participants.
 */

export function AnnouncementManager({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [showCreate, setShowCreate] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 10

  const announcements = useQuery({
    queryKey: ["announcements", courseId, page],
    queryFn: () =>
      apiGetPaged<ContractAnnouncement>(`/courses/${courseId}/announcements?page=${page}&pageSize=${pageSize}`),
  })

  const rows = announcements.data?.data ?? []
  const totalPages = announcements.data?.pagination.totalPages ?? 1

  function invalidate() {
    void queryClient.invalidateQueries({
      queryKey: ["announcements", courseId],
    })
  }

  const create = useMutation({
    mutationFn: (values: {
      title: string
      content: string
      isPublished: boolean
      isPinned: boolean
      priority: string
    }) =>
      apiSend<ContractAnnouncement>("POST", `/courses/${courseId}/announcements`, {
        courseId,
        title: values.title,
        content: values.content,
        isPublished: values.isPublished,
        isPinned: values.isPinned,
        priority: values.priority,
      }),
    onSuccess: () => {
      toast.success("Pengumuman dibuat")
      setShowCreate(false)
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal membuat pengumuman"),
  })

  const act = useMutation({
    mutationFn: async (input: { id: string; action: "pin" | "unpin" | "publish" }) => {
      await apiSend<ContractAnnouncement>("POST", `/announcements/${input.id}/${input.action}`)
    },
    onSuccess: invalidate,
    onError: () => toast.error("Gagal memperbarui pengumuman"),
  })

  const remove = useMutation({
    mutationFn: (id: string) => apiSend<null>("DELETE", `/announcements/${id}`),
    onSuccess: () => {
      toast.success("Pengumuman dihapus")
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menghapus pengumuman"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Pengumuman</h2>
        <Button onClick={() => setShowCreate((v) => !v)}>Pengumuman Baru</Button>
      </div>

      {showCreate ? (
        <AnnouncementForm
          submitting={create.isPending}
          onSubmit={(values) => create.mutate(values)}
          onCancel={() => setShowCreate(false)}
        />
      ) : null}

      {announcements.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title="Belum ada pengumuman" description="Umumkan jadwal atau kabar penting ke peserta." />
      ) : (
        <div className="space-y-4">
          <ItemGroup>
            {rows.map((announcement, index) => (
              <Fragment key={announcement.id}>
                {index > 0 ? <ItemSeparator /> : null}
                <Item>
                  <ItemContent>
                    <ItemTitle>
                      {announcement.isPinned ? <Badge variant="secondary">Disemat</Badge> : null}
                      <Badge variant={announcement.isPublished ? "default" : "outline"}>
                        {announcement.isPublished ? "Terbit" : "Draf"}
                      </Badge>
                      {announcement.title}
                    </ItemTitle>
                    <ItemDescription className="whitespace-pre-wrap">{announcement.content}</ItemDescription>
                    <ItemDescription className="line-clamp-1 text-xs">
                      {announcement.user.name} · {formatCourseDate(announcement.createdAt, { full: false })}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={act.isPending}
                      onClick={() =>
                        act.mutate({
                          id: announcement.id,
                          action: announcement.isPinned ? "unpin" : "pin",
                        })
                      }
                    >
                      {announcement.isPinned ? "Lepas Semat" : "Semat"}
                    </Button>
                    {!announcement.isPublished ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={act.isPending}
                        onClick={() => act.mutate({ id: announcement.id, action: "publish" })}
                      >
                        Terbitkan
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={remove.isPending}
                      onClick={() => {
                        void confirm({
                          title: "Hapus pengumuman?",
                          description: `"${announcement.title}" akan dihapus permanen.`,
                          confirmLabel: "Hapus",
                          destructive: true,
                        }).then((ok) => {
                          if (ok) remove.mutate(announcement.id)
                        })
                      }}
                    >
                      Hapus
                    </Button>
                  </ItemActions>
                </Item>
              </Fragment>
            ))}
          </ItemGroup>

          <Pager page={page} totalPages={totalPages} disabled={announcements.isFetching} onPageChange={setPage} />
        </div>
      )}
    </div>
  )
}

function AnnouncementForm({
  submitting,
  onSubmit,
  onCancel,
}: {
  submitting: boolean
  onSubmit: (values: {
    title: string
    content: string
    isPublished: boolean
    isPinned: boolean
    priority: string
  }) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [isPublished, setIsPublished] = useState(true)
  const [isPinned, setIsPinned] = useState(false)
  const [priority, setPriority] = useState("normal")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) {
      toast.error("Judul dan isi pengumuman wajib diisi")
      return
    }
    onSubmit({ title, content, isPublished, isPinned, priority })
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="announcement-title">Judul</Label>
            <Input id="announcement-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="announcement-content">Isi</Label>
            <Textarea id="announcement-content" rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="announcement-priority">Prioritas</Label>
              <NativeSelect
                id="announcement-priority"
                className="w-full"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <NativeSelectOption value="low">Rendah</NativeSelectOption>
                <NativeSelectOption value="normal">Normal</NativeSelectOption>
                <NativeSelectOption value="high">Tinggi</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={isPublished} onCheckedChange={(c) => setIsPublished(c === true)} />
                Terbitkan sekarang
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={isPinned} onCheckedChange={(c) => setIsPinned(c === true)} />
                Sematkan di atas
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Menyimpan..." : "Buat Pengumuman"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Batal
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
