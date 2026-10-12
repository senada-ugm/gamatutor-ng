import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"

import { formatCourseDate } from "@/lib/lms-date"
import type { ContractDiscussionReply } from "@workspace/contracts/domain"

export interface ReplyNode extends ContractDiscussionReply {
  children: ReplyNode[]
}

export function buildReplyTree(replies: ContractDiscussionReply[]): ReplyNode[] {
  const replyMap = new Map<string, ReplyNode>()
  const rootReplies: ReplyNode[] = []

  replies.forEach((reply) => {
    replyMap.set(reply.id, { ...reply, children: [] })
  })
  replies.forEach((reply) => {
    const node = replyMap.get(reply.id)!
    if (reply.parentReplyId) {
      const parent = replyMap.get(reply.parentReplyId)
      if (parent) parent.children.push(node)
      else rootReplies.push(node)
    } else {
      rootReplies.push(node)
    }
  })

  return rootReplies
}

export const MAX_REPLY_DEPTH = 5

export interface DiscussionReplyNodeProps {
  node: ReplyNode
  depth?: number
  isClosed: boolean
  replyingTo: string | null
  replyContent: string
  isSubmittingReply: boolean
  onSetReplyingTo: (replyId: string | null) => void
  onSetReplyContent: (content: string) => void
  onSubmitReply: (parentReplyId: string) => void
  onDeleteReply: (replyId: string) => void
}

export function DiscussionReplyNode({
  node,
  depth = 0,
  isClosed,
  replyingTo,
  replyContent,
  isSubmittingReply,
  onSetReplyingTo,
  onSetReplyContent,
  onSubmitReply,
  onDeleteReply,
}: DiscussionReplyNodeProps) {
  const canNest = depth < MAX_REPLY_DEPTH
  const isNested = depth > 0

  return (
    <div className={["mt-4 first:mt-0", isNested && "border-l-2 border-border pl-3 sm:pl-4"].join(" ")}>
      <div className="flex items-start gap-2.5">
        <Avatar className="mt-0.5 size-7">
          <AvatarFallback className="text-xs font-medium">
            {(node.user.name || node.user.email).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{node.user.name || node.user.email}</span>
            {!node.isDeleted ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => onDeleteReply(node.id)}
              >
                Hapus
              </Button>
            ) : null}
          </div>
          <span className="text-xs text-muted-foreground">{formatCourseDate(node.createdAt, { full: false })}</span>
          <p className="mt-1 text-sm whitespace-pre-wrap text-foreground/80">
            {node.isDeleted ? "Balasan ini telah dihapus." : node.content}
          </p>
          {canNest && !isClosed && !node.isDeleted ? (
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => onSetReplyingTo(node.id)}>
              Balas
            </Button>
          ) : null}

          {replyingTo === node.id ? (
            <div className="mt-3 space-y-2">
              <Textarea
                value={replyContent}
                onChange={(e) => onSetReplyContent(e.target.value)}
                placeholder="Tulis balasan Anda..."
                rows={3}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => onSubmitReply(node.id)}
                  disabled={isSubmittingReply || !replyContent.trim()}
                >
                  {isSubmittingReply ? "Mengirim..." : "Kirim Balasan"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onSetReplyingTo(null)
                    onSetReplyContent("")
                  }}
                >
                  Batal
                </Button>
              </div>
            </div>
          ) : null}

          {node.children.length > 0 ? (
            <div>
              {node.children.map((child) => (
                <DiscussionReplyNode
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  isClosed={isClosed}
                  replyingTo={replyingTo}
                  replyContent={replyContent}
                  isSubmittingReply={isSubmittingReply}
                  onSetReplyingTo={onSetReplyingTo}
                  onSetReplyContent={onSetReplyContent}
                  onSubmitReply={onSubmitReply}
                  onDeleteReply={onDeleteReply}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
