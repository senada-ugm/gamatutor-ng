import { Fragment } from "react"
import { Link, useParams } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Badge } from "@workspace/ui/components/badge"
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

import { QuizTake } from "@/components/composed/player/quiz-take"
import { EmptyState } from "@/components/composed/_shared/empty-state"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { apiGet } from "@/lib/api"
import type { ContractQuizDetail } from "@workspace/contracts/domain"

interface QuizSummary {
  id: string
  title: string
  questionCount: number
  timeLimit?: number
  maxAttempts: number
}

export function QuizListPage() {
  const { courseId } = useParams({ from: "/learn/$courseId/quizzes" })
  const quizzes = useQuery({
    queryKey: ["quizzes", courseId],
    queryFn: () => apiGet<QuizSummary[]>(`/courses/${courseId}/quizzes?pageSize=50`).catch(() => []),
  })

  if (quizzes.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Kuis" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!quizzes.data || quizzes.data.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Kuis" />
        <EmptyState title="Belum ada kuis" description="Kuis akan muncul di sini setelah instruktur membuatnya." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Kuis" />
      <ItemGroup>
        {quizzes.data.map((quiz, index) => (
          <Fragment key={quiz.id}>
            {index > 0 ? <ItemSeparator /> : null}
            <Item
              render={
                <Link
                  to="/learn/$courseId/quizzes/$quizId"
                  params={{ courseId, quizId: quiz.id }}
                  aria-label={quiz.title}
                />
              }
            >
              <ItemContent>
                <ItemTitle>{quiz.title}</ItemTitle>
                <ItemDescription className="line-clamp-1 text-xs">
                  {quiz.questionCount} soal
                  {quiz.timeLimit ? ` · ${quiz.timeLimit} menit` : ""} ·{" "}
                  {quiz.maxAttempts === 0 ? "Tak terbatas" : `Maks ${quiz.maxAttempts}x`} percobaan
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Badge variant="outline">Kerjakan</Badge>
              </ItemActions>
            </Item>
          </Fragment>
        ))}
      </ItemGroup>
    </div>
  )
}

export function QuizDetailPage() {
  const { quizId } = useParams({ from: "/learn/$courseId/quizzes/$quizId" })
  const quiz = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: () => apiGet<ContractQuizDetail>(`/quizzes/${quizId}`).catch(() => null),
  })

  if (quiz.isLoading) {
    return <Skeleton className="h-64 w-full" />
  }

  if (!quiz.data) {
    return <p className="py-8 text-center text-muted-foreground">Kuis tidak ditemukan.</p>
  }

  return <QuizTake quiz={quiz.data} />
}
