import "@typespec/http";
import "@typespec/rest";

import "./shared/common.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using Lms.Common;

/**
 * Enrollment domain: a student's registration/participation in a course
 * (registered -> interviewed -> selected -> graduated/failed/canceled),
 * plus the richer applicant profile (education/experience/certifications)
 * that participant management needs beyond a plain User account.
 */
namespace Lms {
  enum EnrollmentStatus {
    registered: "registered";
    interviewed: "interviewed";
    selected: "selected";
    failed: "failed";
    graduated: "graduated";
    canceled: "canceled";
  }

  enum EnrollmentType {
    free: "free";
    paid: "paid";
    gifted: "gifted";
    scholarship: "scholarship";
  }

  enum FailureReasonCode {
    attendance: "attendance";
    assessment: "assessment";
    inactive: "inactive";
    violation: "violation";
    withdraw: "withdraw";
    personal: "personal";
    other: "other";
  }

  model Enrollment {
    @key
    id: ResourceId;
    userId: ResourceId;
    courseId: ResourceId;
    status: EnrollmentStatus;
    enrollmentType: EnrollmentType;
    progress: int32;
    completedLessons: int32;
    completedQuizzes: int32;
    completedAssignments: int32;
    @visibility(Lifecycle.Read)
    enrolledAt: utcDateTime;
    approvedAt?: utcDateTime;
    interviewedAt?: utcDateTime;
    interviewNotes?: string;
    failedAt?: utcDateTime;
    failureReason?: FailureReasonCode;
    failureNotes?: string;
    completedAt?: utcDateTime;
    /** Final grade, 0-100. */
    @minValue(0)
    @maxValue(100)
    finalGrade?: int32;
    certificateIssued?: boolean;
    certificateId?: string;
    /** True if the course is free, or if this enrollment's user holds a paid order for this course. */
    isPaid?: boolean;
  }

  enum ParticipantGender {
    male: "male";
    female: "female";
  }

  model EducationEntry {
    degree: string;
    fieldOfStudy?: string;
    schoolName: string;
    startYear: int32;
    endYear?: int32;
  }

  model ExperienceEntry {
    title: string;
    company: string;
    location?: string;
    startYear: int32;
    endYear?: int32;
    ongoing?: boolean;
  }

  model CertificationEntry {
    name: string;
    issuer: string;
    issueYear: int32;
    expYear?: int32;
  }

  /**
   * The applicant-detail profile behind an enrollment - richer than a
   * plain User account (KTP/BPJS/address/education history), specific to
   * the job-training compliance context participant management needs.
   * `id` is the same identifier as the account's User.id.
   */
  model ParticipantProfile {
    @key
    id: ResourceId;
    name: string;
    email: string;
    phone?: string;
    profession?: string;
    institutionName?: string;
    strNumber?: string;
    about?: string;
    educationLevel?: string;
    address?: string;
    residentialAddress?: string;
    dati2?: string;
    gender?: ParticipantGender;
    nationality?: string;
    religion?: string;
    maritalStatus?: string;
    birthDate?: plainDate;
    ktpNumber?: string;
    bpjsKesehatanNumber?: string;
    education: EducationEntry[];
    experience: ExperienceEntry[];
    certifications: CertificationEntry[];
  }

  /** Self-service writable subset of ParticipantProfile. `null` clears a
   *  field; omitted fields stay as they are. */
  model ParticipantProfileUpdate {
    phone?: string | null;
    profession?: string | null;
    institutionName?: string | null;
    strNumber?: string | null;
    about?: string | null;
    educationLevel?: string | null;
    address?: string | null;
    residentialAddress?: string | null;
    dati2?: string | null;
    gender?: ParticipantGender | null;
    nationality?: string | null;
    religion?: string | null;
    maritalStatus?: string | null;
    birthDate?: plainDate | null;
    ktpNumber?: string | null;
    bpjsKesehatanNumber?: string | null;
    education?: EducationEntry[];
    experience?: ExperienceEntry[];
    certifications?: CertificationEntry[];
  }

  /** Writable subset for a student self-enrolling in a course. userId is
   *  the authenticated caller, status always starts "registered". */
  model EnrollmentCreate {
    courseId: ResourceId;
    enrollmentType?: EnrollmentType;
  }

  /**
   * Status transition + the fields relevant to it. Server derives the
   * corresponding timestamp (interviewedAt/approvedAt/failedAt/
   * completedAt) from the transition rather than trusting a client-
   * supplied one. One general update op covers every button
   * ParticipantsPanel exposes (interview, approve, cancel, reactivate,
   * fail, graduate, return-to-registrant, undo-graduation) since they're
   * all just different target `status` values.
   */
  model EnrollmentUpdate {
    status: EnrollmentStatus;
    interviewNotes?: string;
    failureReason?: FailureReasonCode;
    failureNotes?: string;
    @minValue(0)
    @maxValue(100)
    finalGrade?: int32;
  }

  @route("/enrollments")
  @tag("Enrollments")
  interface EnrollmentsApi {
    /** Lists enrollments. Non-admins are scoped to their own rows or
     *  courses they manage. `institutionId` widens that to every course
     *  under one institution, for its owners (and admins) only - the
     *  owner-facing participant list across a whole institution. */
    @get
    @list
    list(
      ...PageParams,
      ...OrderByParam,
      @query courseId?: ResourceId,
      @query institutionId?: ResourceId,
      @query userId?: ResourceId,
      @query status?: EnrollmentStatus
    ): PagedResponse<Enrollment> | ErrorResponse;

    /** Fetches one enrollment — the owner, an admin, or a manager of the enrollment's course. */
    @get
    get(@path id: ResourceId): DataResponse<Enrollment> | ErrorResponse;

    /** Self-enrolls the authenticated caller. */
    /**
     * Self-enrolls the authenticated account. The course must be
     * published, within its registration window, and under its
     * registration quota — course managers bypass the visibility and
     * window checks.
     */
    @post
    create(@body body: EnrollmentCreate): {
      @statusCode statusCode: 201;
      @body body: DataResponse<Enrollment>;
    } | ErrorResponse;

    /** Advances an enrollment's workflow status (approve, fail, graduate, …); graduating auto-issues a certificate. */
    @patch
    update(@path id: ResourceId, @body body: EnrollmentUpdate): DataResponse<Enrollment> | ErrorResponse;

    /** Permanently removes a registrant record (course-management only). */
    /**
     * Deletes an enrollment. Refused with 409 once a certificate has been
     * issued for it — certificates are permanent records.
     */
    @delete
    delete(@path id: ResourceId): {
      @statusCode statusCode: 204;
    } | ErrorResponse;
  }

  @route("/participant-profiles")
  @tag("Enrollments")
  interface ParticipantProfilesApi {
    /** Batch read behind a roster page: the profiles for up to 200
     *  comma-separated `userIds`, one call instead of one per row. Access
     *  is decided per id by the same rule `get` applies, and ids the
     *  caller may not read are omitted rather than failing the call - a
     *  roster row for an account the caller has no claim on degrades to
     *  its id instead of blanking the page. Identity numbers are masked
     *  here for every id but the caller's own, exactly as in `get`. */
    @get
    list(@query userIds: string): DataResponse<ParticipantProfile[]> | ErrorResponse;

    /** Fetches a participant's rich profile (education, experience,
     *  certifications). Self, admin, or a manager of one of their
     *  courses. Only the profile's own account reads ktpNumber and
     *  bpjsKesehatanNumber in full — every other reader gets the masked
     *  tail, since a roster lookup needs to know the number exists, not
     *  what it is. */
    @get
    get(@path id: ResourceId): DataResponse<ParticipantProfile> | ErrorResponse;

    /** Updates the caller's OWN profile only (there is no manager-edit
     *  path). Identity-number fields (ktpNumber, bpjsKesehatanNumber) are
     *  encrypted at rest when PII_ENCRYPTION_KEY is set — see
     *  apps/api/src/lib/pii.ts. Null clears a field; omitted fields are
     *  left untouched. */
    @patch
    update(@path id: ResourceId, @body body: ParticipantProfileUpdate): DataResponse<ParticipantProfile> | ErrorResponse;
  }
}
