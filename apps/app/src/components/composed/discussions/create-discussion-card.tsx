import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"

import { apiSend } from "@/lib/api"
import type { ContractDiscussionDetail } from "@workspace/contracts/domain"

export interface CreateDiscussionCardProps {
  courseId: string
  onDone: () => void
}

export function CreateDiscussionCard({ courseId, onDone }: CreateDiscussionCardProps) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: () => apiSend<ContractDiscussionDetail>("POST", `/courses/${courseId}/discussions`, { title, content }),
    onSuccess: () => {
      toast.success("Diskusi dibuat")
      onDone()
      void queryClient.invalidateQueries({
        queryKey: ["discussions", courseId],
      })
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Gagal membuat diskusi"),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) {
      setError("Judul dan isi diskusi wajib diisi.")
      return
    }
    setError(null)
    create.mutate()
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="discussion-title">Judul</Label>
            <Input
              id="discussion-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Apa yang ingin Anda diskusikan?"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discussion-content">Isi</Label>
            <Textarea
              id="discussion-content"
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tuliskan pertanyaan atau topik Anda..."
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Membuat..." : "Buat Diskusi"}
            </Button>
            <Button type="button" variant="outline" onClick={onDone}>
              Batal
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
