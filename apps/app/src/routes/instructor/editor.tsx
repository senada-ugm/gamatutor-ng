import { Link, Outlet, useMatchRoute, useParams } from "@tanstack/react-router"
import { createContext, useContext } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { BarChart3, BookOpen, Users } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

import { CourseStatusBadge } from "@/components/composed/courses/_atoms/course-status-badge"
import { CourseThumbnail } from "@/components/composed/courses/_atoms/course-thumbnail"
import { EmptyState } from "@/components/composed/_shared/empty-state"
import { ErrorState } from "@/components/composed/_shared/error-state"
import { PageHeader } from "@/components/composed/_shared/page-header"
import { TabNav, tabNavItemProps } from "@/components/composed/_shared/tab-nav"
import { apiGet, apiSend } from "@/lib/api"
import { COURSE_TYPE_LABELS, LEVEL_LABELS } from "@/lib/labels"
import type { ContractCourse } from "@workspace/contracts/domain"

type EditorRoutePath =
  | "/instructor/courses/$courseId/editor"
  | "/instructor/courses/$courseId/editor/konten"
  | "/instructor/courses/$courseId/editor/kuis"
  | "/instructor/courses/$courseId/editor/penilaian"
  | "/instructor/courses/$courseId/editor/presensi"
  | "/instructor/courses/$courseId/editor/peserta"
  | "/instructor/courses/$courseId/editor/instruktur"
  | "/instructor/courses/$courseId/editor/pengumuman"
  | "/instructor/courses/$courseId/editor/pembayaran"
  | "/instructor/courses/$courseId/editor/kupon"
  | "/instructor/courses/$courseId/editor/sertifikat"
  | "/instructor/courses/$courseId/editor/laporan"

interface TabItem {
  to: EditorRoutePath
  label: string
  exact?: boolean
}

interface TabGroup {
  id: string
  label: string
  icon: typeof BookOpen
  tabs: TabItem[]
}

const TAB_GROUPS: readonly TabGroup[] = [
  {
    id: "curriculum",
    label: "Kurikulum & Pembelajaran",
    icon: BookOpen,
    tabs: [
      { to: "/instructor/courses/$courseId/editor", label: "Detail", exact: true },
      { to: "/instructor/courses/$courseId/editor/konten", label: "Konten" },
      { to: "/instructor/courses/$courseId/editor/kuis", label: "Kuis" },
      { to: "/instructor/courses/$courseId/editor/penilaian", label: "Penilaian" },
      { to: "/instructor/courses/$courseId/editor/presensi", label: "Presensi" },
    ],
  },
  {
    id: "audience",
    label: "Peserta & Komunikasi",
    icon: Users,
    tabs: [
      { to: "/instructor/courses/$courseId/editor/peserta", label: "Peserta" },
      { to: "/instructor/courses/$courseId/editor/instruktur", label: "Instruktur" },
      { to: "/instructor/courses/$courseId/editor/pengumuman", label: "Pengumuman" },
    ],
  },
  {
    id: "operations",
    label: "Komersial & Hasil",
    icon: BarChart3,
    tabs: [
      { to: "/instructor/courses/$courseId/editor/pembayaran", label: "Pembayaran" },
      { to: "/instructor/courses/$courseId/editor/kupon", label: "Kupon" },
      { to: "/instructor/courses/$courseId/editor/sertifikat", label: "Sertifikat" },
      { to: "/instructor/courses/$courseId/editor/laporan", label: "Laporan" },
    ],
  },
]

/**
 * Editor layout: fetches the course once and hands it to the tab routes
 * (Detail at the index, Konten, Peserta) via context — the same shape as
 * the player's CourseContext, so tabs refetch by invalidating ["course"].
 */

const EditorCourseContext = createContext<ContractCourse | null>(null)

export function useEditorCourse(): ContractCourse {
  const course = useContext(EditorCourseContext)
  if (!course) throw new Error("useEditorCourse must be used inside the editor layout")
  return course
}

export function EditorLayout() {
  // Pathless workspace layout: the URL stays /instructor/..., but the
  // route id chain includes the "workspace" prefix.
  const { courseId } = useParams({
    from: "/workspace/management/instructor/courses/$courseId/editor",
  })
  const queryClient = useQueryClient()
  const matchRoute = useMatchRoute()
  const params = { courseId }

  const isTabActive = (tab: TabItem) =>
    Boolean(
      matchRoute({
        to: tab.to,
        params,
        fuzzy: !tab.exact,
      })
    )

  const activeGroup = TAB_GROUPS.find((group) => group.tabs.some(isTabActive)) ?? TAB_GROUPS[0]

  const course = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => apiGet<ContractCourse>(`/courses/${courseId}`),
  })

  const publishToggle = useMutation({
    mutationFn: (publish: boolean) =>
      apiSend<ContractCourse>("POST", `/courses/${courseId}/${publish ? "publish" : "unpublish"}`),
    onSuccess: () => {
      toast.success("Status pelatihan diperbarui")
      void queryClient.invalidateQueries({ queryKey: ["course", courseId] })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal mengubah status"),
  })

  if (course.isLoading || !course.data) {
    return (
      <div className="space-y-6">
        <PageHeader backTo="/instructor" backLabel="Kelola Pelatihan" />
        {course.isLoading ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-48 w-full" />
          </>
        ) : course.isError ? (
          <ErrorState error={course.error} onRetry={() => void course.refetch()} />
        ) : (
          <EmptyState title="Pelatihan tidak ditemukan" />
        )}
      </div>
    )
  }

  const c = course.data

  return (
    <EditorCourseContext.Provider value={c}>
      <div className="space-y-6">
        <PageHeader backTo="/instructor" backLabel="Kelola Pelatihan" />

        <Card>
          <CardContent className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-start gap-3">
              <CourseThumbnail thumbnail={c.thumbnail} className="hidden size-12 shrink-0 rounded-lg sm:block" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="line-clamp-2 text-2xl font-semibold tracking-tight">{c.title}</h1>
                  <CourseStatusBadge status={c.status} />
                </div>
                {c.shortDescription ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.shortDescription}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:text-sm">
                  <Badge variant="outline">{COURSE_TYPE_LABELS[c.courseType] ?? c.courseType}</Badge>
                  <span aria-hidden="true">·</span>
                  <span>{LEVEL_LABELS[c.level] ?? c.level}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {c.registrantCount} pendaftar / {c.participantCount} peserta
                  </span>
                </div>
              </div>
            </div>

            <div className="shrink-0">
              {c.status === "draft" ? (
                <Button onClick={() => publishToggle.mutate(true)} disabled={publishToggle.isPending}>
                  {publishToggle.isPending ? "Menerbitkan..." : "Terbitkan"}
                </Button>
              ) : c.status === "published" ? (
                <Button
                  variant="secondary"
                  onClick={() => publishToggle.mutate(false)}
                  disabled={publishToggle.isPending}
                >
                  {publishToggle.isPending ? "Membatalkan..." : "Batalkan Terbit"}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {/* Category quick-switch bar */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/40 p-1">
            {TAB_GROUPS.map((group) => {
              const isGroupActive = activeGroup.id === group.id
              const Icon = group.icon
              return (
                <Link
                  key={group.id}
                  to={group.tabs[0].to}
                  params={params}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all sm:text-sm",
                    isGroupActive
                      ? "bg-background font-semibold text-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{group.label}</span>
                  <Badge variant={isGroupActive ? "secondary" : "outline"}>{group.tabs.length}</Badge>
                </Link>
              )
            })}
          </div>

          {/* Grouped TabNav containing all tabs partitioned with visual dividers */}
          <TabNav>
            {TAB_GROUPS.map((group, groupIdx) => (
              <div key={group.id} className="flex shrink-0 items-center gap-0.5">
                {groupIdx > 0 && <div className="mx-1.5 h-4 w-px shrink-0 bg-border" aria-hidden="true" />}
                {group.tabs.map((tab) => (
                  <Link key={tab.to} to={tab.to} params={params} {...tabNavItemProps(isTabActive(tab))}>
                    {tab.label}
                  </Link>
                ))}
              </div>
            ))}
          </TabNav>
        </div>

        <Outlet />
      </div>
    </EditorCourseContext.Provider>
  )
}
