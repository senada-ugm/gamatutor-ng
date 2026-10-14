import "@typespec/http";
import "@typespec/rest";

import "./shared/common.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using Lms.Common;

/**
 * Read-only aggregates for the manager dashboards: one call per course
 * with every participant's funnel/progress row (the data the
 * ParticipantsPanel currently assembles client-side), plus
 * platform/institution totals for the admin and owner dashboards.
 *
 * The CSV export of a course's participant table lives OUTSIDE this
 * contract (GET /v1/courses/{id}/participants/export, text/csv) — same
 * operational-endpoint precedent as POST /uploads/sweep: the data is
 * fully described here; only the file formatting is operational.
 */
namespace Lms {
  model ReportUser {
    id: ResourceId;
    name: string;
    email: string;
  }

  model CourseReportParticipant {
    user: ReportUser;
    enrollmentStatus: EnrollmentStatus;
    progressPercent: int32;
    completedLessons: int32;
    finalGrade?: int32;
    certificateId?: ResourceId;
  }

  model CourseReport {
    courseId: ResourceId;
    title: string;
    registrantCount: int32;
    participantCount: int32;
    totalLessons: int32;
    participants: CourseReportParticipant[];
  }

  @route("/courses/{courseId}/report")
  @tag("Reports")
  interface CourseReportsApi {
    /** Full participant table for a course: funnel status, lesson
     *  progress, attendance summary, grade, certificate. Course
     *  managers only. */
    @get
    get(@path courseId: ResourceId): DataResponse<CourseReport> | ErrorResponse;
  }

  model AdminStudyTime {
    totalDwellSeconds: int32;
    dwell30dSeconds: int32;
    /** Distinct learners with at least one logged event in the last 30 days. */
    activeLearners30d: int32;
  }

  model AdminOverview {
    totalUsers: int32;
    totalInstitutions: int32;
    totalCourses: int32;
    totalEnrollments: int32;
    /** selected enrollments. */
    activeParticipants: int32;
    graduatedParticipants: int32;
    /** graduated as a percent of selected+graduated, rounded. */
    completionRate: int32;
    growth30d: AdminGrowth30d;
    /** Platform-wide study-time aggregates (Review note #15). */
    studyTime: AdminStudyTime;
  }

  model AdminGrowth30d {
    newUsers: int32;
    newCourses: int32;
    newEnrollments: int32;
    newInstitutions: int32;
  }

  model InstitutionReportCourseRow {
    courseId: ResourceId;
    title: string;
    status: CourseStatus;
    registrantCount: int32;
    participantCount: int32;
    graduatedCount: int32;
  }

  /**
   * One institution's funnel in a single call - the owner's equivalent
   * of AdminOverview, scoped to what they own. Counts follow the same
   * definitions the course-level report uses: a registrant is any
   * enrollment that was not canceled or failed, a participant is
   * selected or graduated.
   */
  model InstitutionReport {
    institutionId: ResourceId;
    name: string;
    courseCount: int32;
    publishedCourseCount: int32;
    registrantCount: int32;
    participantCount: int32;
    graduatedCount: int32;
    /** graduated as a percent of selected+graduated, rounded; 0 when none. */
    completionRate: int32;
    byCourse: InstitutionReportCourseRow[];
  }

  @route("/institutions/{institutionId}/report")
  @tag("Reports")
  interface InstitutionReportsApi {
    /** Funnel for one institution, broken down by course. The
     *  institution's owners and admins only. */
    @get
    get(@path institutionId: ResourceId): DataResponse<InstitutionReport> | ErrorResponse;
  }

  @route("/admin/overview")
  @tag("Reports")
  interface AdminReportsApi {
    /** Platform totals + 30-day growth for the admin dashboard. Admin only. */
    @get
    get(): DataResponse<AdminOverview> | ErrorResponse;
  }

}
