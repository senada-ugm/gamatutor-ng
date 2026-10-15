import {
  createRouter,
  createRootRoute,
  createRoute,
  lazyRouteComponent,
  Link,
  Outlet,
  redirect,
} from "@tanstack/react-router"

import { Button } from "@workspace/ui/components/button"

import { ManagementShell } from "@/components/composed/workspace/management-shell"
import { WorkspaceShell } from "@/components/composed/workspace/workspace-shell"
import { getSession } from "@/lib/auth"
import { DashboardPage } from "@/routes/dashboard"

/**
 * Code-based routing with lazy-loaded route components for fast initial load.
 * TanStack Router's `lazyRouteComponent` handles code-splitting and pairs with
 * `defaultPreload: "intent"` to preload chunks on hover/intent.
 */

function RouteFallback({ title, description }: { title: string; description: string }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button nativeButton={false} render={<Link to="/dashboard" />}>
        Kembali ke Dasbor
      </Button>
    </main>
  )
}

const rootRoute = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: () => (
    <RouteFallback title="Halaman tidak ditemukan" description="Tautan ini mungkin sudah berubah atau dihapus." />
  ),
  errorComponent: () => (
    <RouteFallback title="Terjadi kesalahan" description="Muat ulang halaman atau kembali ke dasbor." />
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: lazyRouteComponent(() => import("@/routes/landing"), "LandingPage"),
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: lazyRouteComponent(() => import("@/routes/login"), "LoginPage"),
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: lazyRouteComponent(() => import("@/routes/register"), "RegisterPage"),
})

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/forgot-password",
  component: lazyRouteComponent(() => import("@/routes/forgot-password"), "ForgotPasswordPage"),
})

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reset-password",
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: lazyRouteComponent(() => import("@/routes/reset-password"), "ResetPasswordPage"),
})

// Every authenticated page shares one session guard; the chrome-less
// player (/learn/**) stays outside it on purpose. Beneath the guard the
// tree forks into two shells — see management-shell.tsx for why the
// learner and management surfaces don't share chrome.
const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "workspace",
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) throw redirect({ to: "/login" })
  },
})

// Learner surfaces: top nav.
const learnerRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  id: "learner",
  component: () => (
    <WorkspaceShell>
      <Outlet />
    </WorkspaceShell>
  ),
})

// Management console: sidebar, institution scope.
const managementRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  id: "management",
  component: ManagementShell,
})

const dashboardRoute = createRoute({
  getParentRoute: () => learnerRoute,
  path: "/dashboard",
  component: DashboardPage,
})

// The institution's own pages sit beside /instructor rather than under
// it: they are scoped by the sidebar's institution switcher, not by a
// course, and an owner reads them without ever opening a course editor.
const institutionRoute = createRoute({
  getParentRoute: () => managementRoute,
  path: "/institution",
})

const institutionOverviewRoute = createRoute({
  getParentRoute: () => institutionRoute,
  path: "/",
  component: lazyRouteComponent(() => import("@/routes/institution/overview"), "InstitutionOverviewPage"),
})

const institutionParticipantsRoute = createRoute({
  getParentRoute: () => institutionRoute,
  path: "/peserta",
  component: lazyRouteComponent(() => import("@/routes/institution/participants"), "InstitutionParticipantsPage"),
})

const instructorRoute = createRoute({
  getParentRoute: () => managementRoute,
  path: "/instructor",
})

const instructorIndexRoute = createRoute({
  getParentRoute: () => instructorRoute,
  path: "/",
  component: lazyRouteComponent(() => import("@/routes/instructor/index"), "InstructorCoursesPage"),
})

const instructorNewCourseRoute = createRoute({
  getParentRoute: () => instructorRoute,
  path: "/courses/new",
  component: lazyRouteComponent(() => import("@/routes/instructor/new"), "NewCoursePage"),
})

const editorLayoutRoute = createRoute({
  getParentRoute: () => instructorRoute,
  path: "/courses/$courseId/editor",
  component: lazyRouteComponent(() => import("@/routes/instructor/editor"), "EditorLayout"),
})

const editorIndexRoute = createRoute({
  getParentRoute: () => editorLayoutRoute,
  path: "/",
  component: lazyRouteComponent(() => import("@/routes/instructor/editor-detail"), "EditorDetailTab"),
})

const editorContentRoute = createRoute({
  getParentRoute: () => editorLayoutRoute,
  path: "/konten",
  component: lazyRouteComponent(() => import("@/routes/instructor/editor-content"), "EditorContentTab"),
})

const editorParticipantsRoute = createRoute({
  getParentRoute: () => editorLayoutRoute,
  path: "/peserta",
  component: lazyRouteComponent(() => import("@/routes/instructor/editor-participants"), "EditorParticipantsTab"),
})

const editorQuizzesRoute = createRoute({
  getParentRoute: () => editorLayoutRoute,
  path: "/kuis",
  component: lazyRouteComponent(() => import("@/routes/instructor/editor-quizzes"), "EditorQuizzesTab"),
})

const editorAssessmentsRoute = createRoute({
  getParentRoute: () => editorLayoutRoute,
  path: "/penilaian",
  component: lazyRouteComponent(() => import("@/routes/instructor/editor-assessments"), "EditorAssessmentsTab"),
})

const editorCertificatesRoute = createRoute({
  getParentRoute: () => editorLayoutRoute,
  path: "/sertifikat",
  component: lazyRouteComponent(() => import("@/routes/instructor/editor-certificates"), "EditorCertificatesTab"),
})

const editorInstructorsRoute = createRoute({
  getParentRoute: () => editorLayoutRoute,
  path: "/instruktur",
  component: lazyRouteComponent(() => import("@/routes/instructor/editor-instructors"), "EditorInstructorsTab"),
})

const editorAnnouncementsRoute = createRoute({
  getParentRoute: () => editorLayoutRoute,
  path: "/pengumuman",
  component: lazyRouteComponent(() => import("@/routes/instructor/editor-announcements"), "EditorAnnouncementsTab"),
})

const editorReportRoute = createRoute({
  getParentRoute: () => editorLayoutRoute,
  path: "/laporan",
  component: lazyRouteComponent(() => import("@/routes/instructor/editor-report"), "EditorReportTab"),
})

const notificationsRoute = createRoute({
  getParentRoute: () => learnerRoute,
  path: "/notifications",
  component: lazyRouteComponent(() => import("@/routes/notifications"), "NotificationsPage"),
})

const adminRoute = createRoute({
  getParentRoute: () => managementRoute,
  path: "/admin",
})

const adminIndexRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/",
  component: lazyRouteComponent(() => import("@/routes/admin/dashboard"), "AdminDashboardPage"),
})

const adminUsersRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/users",
  component: lazyRouteComponent(() => import("@/routes/admin/users"), "AdminUsersPage"),
})

const adminInstitutionsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/institutions",
  component: lazyRouteComponent(() => import("@/routes/admin/institutions"), "AdminInstitutionsPage"),
})

const adminSettingsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/settings",
  component: lazyRouteComponent(() => import("@/routes/admin/settings"), "AdminSettingsPage"),
})

const adminAuditRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/audit",
  component: lazyRouteComponent(() => import("@/routes/admin/audit"), "AdminAuditPage"),
})

const courseCatalogRoute = createRoute({
  getParentRoute: () => learnerRoute,
  path: "/courses",
  component: lazyRouteComponent(() => import("@/routes/courses/index"), "CourseCatalogPage"),
})

const courseDetailRoute = createRoute({
  getParentRoute: () => learnerRoute,
  path: "/courses/$courseId",
  component: lazyRouteComponent(() => import("@/routes/courses/$courseId"), "CourseDetailPage"),
})

const certificateViewRoute = createRoute({
  getParentRoute: () => learnerRoute,
  path: "/certificates/$certificateId",
  component: lazyRouteComponent(() => import("@/routes/certificates"), "CertificateViewPage"),
})

const certificateVerifyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/certificates/verify",
  validateSearch: (search: Record<string, unknown>): { code?: string } => ({
    code: typeof search.code === "string" ? search.code : undefined,
  }),
  component: lazyRouteComponent(() => import("@/routes/certificates"), "CertificateVerifyPage"),
})

const profileRoute = createRoute({
  getParentRoute: () => learnerRoute,
  path: "/profile",
  component: lazyRouteComponent(() => import("@/routes/profile"), "ProfilePage"),
})

// Learn player — layout route with nested children
const learnLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/learn/$courseId",
  component: lazyRouteComponent(() => import("@/routes/learn/layout"), "LearnLayout"),
})

const learnIndexRoute = createRoute({
  getParentRoute: () => learnLayoutRoute,
  path: "/",
  component: lazyRouteComponent(() => import("@/routes/learn/index"), "LearnIndex"),
})

const learnLessonRoute = createRoute({
  getParentRoute: () => learnLayoutRoute,
  path: "/lesson/$lessonId",
  component: lazyRouteComponent(() => import("@/routes/learn/lesson"), "LessonPage"),
})

const learnQuizzesRoute = createRoute({
  getParentRoute: () => learnLayoutRoute,
  path: "/quizzes",
  component: lazyRouteComponent(() => import("@/routes/learn/quizzes"), "QuizListPage"),
})

const learnQuizDetailRoute = createRoute({
  getParentRoute: () => learnLayoutRoute,
  path: "/quizzes/$quizId",
  component: lazyRouteComponent(() => import("@/routes/learn/quizzes"), "QuizDetailPage"),
})

const learnAssignmentsRoute = createRoute({
  getParentRoute: () => learnLayoutRoute,
  path: "/assignments",
  component: lazyRouteComponent(() => import("@/routes/learn/assignments"), "AssignmentListPage"),
})

const learnAssignmentDetailRoute = createRoute({
  getParentRoute: () => learnLayoutRoute,
  path: "/assignments/$assignmentId",
  component: lazyRouteComponent(() => import("@/routes/learn/assignments"), "AssignmentDetailPage"),
})

const learnAnnouncementsRoute = createRoute({
  getParentRoute: () => learnLayoutRoute,
  path: "/pengumuman",
  component: lazyRouteComponent(() => import("@/routes/learn/announcements"), "PlayerAnnouncementsPage"),
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  certificateVerifyRoute,
  workspaceRoute.addChildren([
    learnerRoute.addChildren([
      dashboardRoute,
      notificationsRoute,
      courseCatalogRoute,
      courseDetailRoute,
      profileRoute,
      certificateViewRoute,
    ]),
    managementRoute.addChildren([
      adminRoute.addChildren([
        adminIndexRoute,
        adminUsersRoute,
        adminInstitutionsRoute,
        adminSettingsRoute,
        adminAuditRoute,
      ]),
      institutionRoute.addChildren([institutionOverviewRoute, institutionParticipantsRoute]),
      instructorRoute.addChildren([
        instructorIndexRoute,
        instructorNewCourseRoute,
        editorLayoutRoute.addChildren([
          editorIndexRoute,
          editorContentRoute,
          editorParticipantsRoute,
          editorQuizzesRoute,
          editorAssessmentsRoute,
          editorCertificatesRoute,
          editorInstructorsRoute,
          editorAnnouncementsRoute,
          editorReportRoute,
        ]),
      ]),
    ]),
  ]),
  learnLayoutRoute.addChildren([
    learnIndexRoute,
    learnLessonRoute,
    learnQuizzesRoute,
    learnQuizDetailRoute,
    learnAssignmentsRoute,
    learnAssignmentDetailRoute,
    learnAnnouncementsRoute,
  ]),
])

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
