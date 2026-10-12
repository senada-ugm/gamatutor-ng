import "@typespec/http";
import "@typespec/rest";

import "./shared/common.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using Lms.Common;

/**
 * Attendance domain: instructor-scheduled sessions with two independent
 * verification layers - a challenge (rotating numeric code or rotating QR
 * token) and an optional geofence (lat/long/radius) that applies
 * regardless of which challenge is active. See checkIn's doc comment for
 * how the two combine.
 */
namespace Lms {
  enum AttendanceSessionStatus {
    pending: "pending";
    active: "active";
    completed: "completed";
    cancelled: "cancelled";
    holiday: "holiday";
  }

  enum AttendanceVerificationMethod {
    none: "none";
    code: "code";
    qr: "qr";
  }

  enum AttendanceRecordStatus {
    present: "present";
    late: "late";
    absent: "absent";
    excused: "excused";
  }

  model AttendanceSession {
    @key
    id: ResourceId;
    courseId: ResourceId;
    title: string;
    sessionDate: utcDateTime;
    startTime?: string;
    endTime?: string;
    sessionStatus: AttendanceSessionStatus;
    verificationMethod: AttendanceVerificationMethod;
    @visibility(Lifecycle.Read)
    codeExpirySeconds?: int32;
    /** Present only when the caller manages the course - never shown to a
     *  student, who checks in without seeing the current code/token. */
    @visibility(Lifecycle.Read)
    verificationCode?: string;
    @visibility(Lifecycle.Read)
    qrToken?: string;
    latitude?: float64;
    longitude?: float64;
    radiusMeters?: int32;
    lateThresholdMinutes: int32;
    notes?: string;
  }

  model AttendanceSessionCreate {
    title: string;
    sessionDate: utcDateTime;
    startTime?: string;
    endTime?: string;
    lateThresholdMinutes?: int32;
  }

  model AttendanceSessionUpdate {
    title?: string;
    sessionStatus?: AttendanceSessionStatus;
    startTime?: string;
    endTime?: string;
    lateThresholdMinutes?: int32;
    notes?: string;
  }

  /** Activates a session: sets status to active and (re)generates
   *  whichever challenge(s) the chosen method needs. Geofence is set here
   *  too, independent of method - if latitude/longitude are omitted, any
   *  previously-set geofence is cleared. */
  model AttendanceSessionActivate {
    verificationMethod: AttendanceVerificationMethod;
    latitude?: float64;
    longitude?: float64;
    radiusMeters?: int32;
  }

  model AttendanceRecord {
    @key
    id: ResourceId;
    sessionId: ResourceId;
    userId: ResourceId;
    status: AttendanceRecordStatus;
    checkedInAt?: utcDateTime;
    checkedInMethod?: "manual" | "code" | "qr";
    excuseReason?: string;
  }

  model AttendanceCheckIn {
    code?: string;
    qrToken?: string;
    latitude?: float64;
    longitude?: float64;
  }

  model AttendanceRecordManualUpdate {
    status: AttendanceRecordStatus;
    excuseReason?: string;
  }

  model EnrolledStudentUser {
    id: ResourceId;
    name: string;
    email: string;
  }

  /** One enrolled student + their record for a given session, if any -
   *  the combined roster+record view AttendanceRecords needs. */
  model EnrolledStudentAttendance {
    user: EnrolledStudentUser;
    record?: AttendanceRecord;
  }

  @route("/courses/{courseId}/attendance-sessions")
  @tag("Attendance")
  interface CourseAttendanceSessionsApi {
    /** Lists a course's attendance sessions. Verification details are manager-only. */
    @get
    @list
    list(@path courseId: ResourceId, ...PageParams): PagedResponse<AttendanceSession> | ErrorResponse;

    /** Creates an attendance session for a course. Course-management only. */
    @post
    create(@path courseId: ResourceId, @body body: AttendanceSessionCreate): {
      @statusCode statusCode: 201;
      @body body: DataResponse<AttendanceSession>;
    } | ErrorResponse;
  }

  @route("/attendance-sessions/{id}")
  @tag("Attendance")
  interface AttendanceSessionsApi {
    /** Fetches one attendance session. The verification code/QR token is included only for course managers. */
    @get
    get(@path id: ResourceId): DataResponse<AttendanceSession> | ErrorResponse;

    /** Updates a session's schedule/threshold fields. Course-management only. */
    @patch
    update(@path id: ResourceId, @body body: AttendanceSessionUpdate): DataResponse<AttendanceSession> | ErrorResponse;

    /** Activates a session, generating the verification code or QR token for the chosen method. */
    @post
    @route("activate")
    activate(@path id: ResourceId, @body body: AttendanceSessionActivate): DataResponse<AttendanceSession> | ErrorResponse;

    /** Enrolled roster + each student's record for this session. */
    @get
    @route("roster")
    roster(@path id: ResourceId): DataResponse<EnrolledStudentAttendance[]> | ErrorResponse;

    /** The authenticated caller's own record for this session, if any -
     *  lets a student's check-in UI know whether they've already checked
     *  in without needing course-management rights (unlike `roster`). */
    @get
    @route("my-record")
    myRecord(@path id: ResourceId): DataResponse<AttendanceRecord | null> | ErrorResponse;

    /**
     * Student self-check-in. Validates, in order: session is active; the
     * challenge matching `verificationMethod` (code or qrToken, checked
     * against the session's current value + expiry); the geofence (if the
     * session has coordinates configured) regardless of which challenge
     * was used. Computes present/late from lateThresholdMinutes.
     */
    @post
    @route("check-in")
    checkIn(@path id: ResourceId, @body body: AttendanceCheckIn): DataResponse<AttendanceRecord> | ErrorResponse;

    /** Manually sets a student's attendance record. Course-management only. */
    @patch
    @route("records/{userId}")
    markRecord(
      @path id: ResourceId,
      @path userId: ResourceId,
      @body body: AttendanceRecordManualUpdate
    ): DataResponse<AttendanceRecord> | ErrorResponse;
  }
}
