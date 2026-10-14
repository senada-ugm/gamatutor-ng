import { Fragment, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@workspace/ui/components/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { BackLink } from "@/components/composed/_shared/back-link"
import { EmptyState } from "@/components/composed/_shared/empty-state"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { QuizTake } from "@/components/composed/player/quiz-take"
import { apiGet } from "@/lib/api"
import type { ContractQuizDetail } from "@workspace/contracts/domain"

/**
 * Standalone assessments (career/psychometric quizzes) — the same quiz
 * engine as course quizzes, just without a courseId. Taking one reuses
 * QuizTake wholesale.
 */

interface AssessmentSummary {
  id: string
  title: string
  description?: string
  questionCount: number
  timeLimit?: number | null
  maxAttempts: number
}

export function AssessmentsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const assessments = useQuery({
    queryKey: ["assessments"],
    queryFn: () => apiGet<AssessmentSummary[]>("/assessments?pageSize=100"),
  })

  const selected = useQuery({
    queryKey: ["quiz", selectedId],
    queryFn: () => apiGet<ContractQuizDetail>(`/quizzes/${selectedId}`),
    enabled: selectedId != null,
  })

  if (selectedId) {
    if (selected.isLoading) return <Skeleton className="h-64 w-full" />
    if (!selected.data) {
      return <EmptyState title="Asesmen tidak ditemukan" />
    }
    return (
      <div>
        <BackLink onClick={() => setSelectedId(null)} label="Kembali ke Asesmen" />
        <QuizTake quiz={selected.data} />
      </div>
    )
  }

  const rows = assessments.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Asesmen"
        description="Tes minat dan gaya belajar — hasil membantu merekomendasikan pelatihan."
      />

      {assessments.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : assessments.isError ? (
        <ErrorState error={assessments.error} onRetry={() => void assessments.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="Belum ada asesmen" description="Asesmen akan muncul di sini saat tersedia." />
      ) : (
        <ItemGroup>
          {rows.map((assessment, index) => (
            <Fragment key={assessment.id}>
              {index > 0 ? <ItemSeparator /> : null}
              <Item>
                <ItemContent>
                  <ItemTitle>{assessment.title}</ItemTitle>
                  {assessment.description ? (
                    <ItemDescription className="line-clamp-1">{assessment.description}</ItemDescription>
                  ) : null}
                  <ItemDescription className="line-clamp-1 text-xs">
                    {assessment.questionCount} soal
                    {assessment.timeLimit ? ` · ${assessment.timeLimit} menit` : ""}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button size="sm" onClick={() => setSelectedId(assessment.id)}>
                    Kerjakan
                  </Button>
                </ItemActions>
              </Item>
            </Fragment>
          ))}
        </ItemGroup>
      )}
    </div>
  )
}
