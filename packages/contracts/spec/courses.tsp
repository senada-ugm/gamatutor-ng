import "@typespec/http";
import "@typespec/rest";

import "./shared/common.tsp";
import "./course-content.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using Lms.Common;

/**
 * Course domain: the catalog/authoring resource everything else (course
 * instructors, enrollments, assignments, quizzes, ...) hangs off of.
 */
namespace Lms {
  enum CourseType {
    online: "online";
    offline: "offline";
    hybrid: "hybrid";
  }

  enum CourseLevel {
    beginner: "beginner";
    intermediate: "intermediate";
    advanced: "advanced";
    expert: "expert";
  }

  enum CourseStatus {
    draft: "draft";
    published: "published";
    archived: "archived";
    underReview: "under_review";
  }

  enum TrainingType {
    pbk: "pbk";
    wirausaha: "wirausaha";
    lainnya: "lainnya";
  }

  enum FundingSource {
    apbd: "APBD";
    apbn: "APBN";
    csr: "CSR";
    dbhcht: "DBHCHT";
    lainnya: "Lainnya";
  }

  /**
   * The course's denormalized display instructor. Distinct from the
   * course-instructor invite/roster join (course-instructors.ts) — that's
   * a separate not-yet-contracted domain — named Summary here so the two
   * don't collide once it is.
   */
  model CourseInstructorSummary {
    id: ResourceId;
    name: string;
    image?: string | null;
  }

  /** The course's denormalized display institution — just enough for a
   *  catalog card (name + logo) without a separate per-card institution
   *  fetch. Same "Summary" shape as CourseInstructorSummary. */
  model CourseInstitutionSummary {
    id: ResourceId;
    name: string;
    logo?: string | null;
  }

  model Course {
    @key
    id: ResourceId;
    slug: string;
    title: string;
    shortDescription?: string;
    description?: string;
    thumbnail?: string | null;
    courseType: CourseType;
    location?: string;
    scheduledAt?: utcDateTime;
    scheduledEndAt?: utcDateTime;
    registrationOpenAt?: utcDateTime;
    registrationCloseAt?: utcDateTime;
    registrantQuota?: int32;
    participantQuota?: int32;
    @visibility(Lifecycle.Read)
    registrantCount: int32;
    @visibility(Lifecycle.Read)
    participantCount: int32;
    level: CourseLevel;
    language: string;
    trainingType?: TrainingType;
    customTrainingType?: string;
    isDisabilityFriendly: boolean;
    supportedDisabilityTypes: string[];
    minimumEducation?: string;
    minimumAge?: int32;
    maximumAge?: int32;
    cityCode?: string;
    fundingSource?: FundingSource;
    customFundingSource?: string;
    trainingBudget?: int32;
    contactPersonName?: string;
    contactPersonPhone?: string;
    status: CourseStatus;
    institutionId: ResourceId;
    @visibility(Lifecycle.Read)
    institution: CourseInstitutionSummary;
    instructor: CourseInstructorSummary;
    modules: Module[];
    @visibility(Lifecycle.Read)
    updatedAt?: utcDateTime;
    /** Mockup-only: price in Rupiah. Absent/null means free — the real
     *  product has this feature-flagged off (see courses.ts's fixture
     *  comment). */
    price?: int32;
  }

  /**
   * Writable subset for editing an existing course — what CourseForm's
   * edit mode submits. institutionId, instructor, slug, status and modules
   * aren't collected by that form and stay unchanged by this op; module/
   * lesson authoring and status transitions are separate, not-yet-
   * contracted concerns. level/language are also not collected by
   * CourseForm today — optional here, left unchanged when omitted (create
   * falls back to a server default; see CourseCreate).
   */
  model CourseUpdate {
    title: string;
    shortDescription?: string;
    description?: string;
    thumbnail?: string | null;
    courseType: CourseType;
    location?: string;
    scheduledAt?: utcDateTime;
    scheduledEndAt?: utcDateTime;
    registrationOpenAt?: utcDateTime;
    registrationCloseAt?: utcDateTime;
    registrantQuota?: int32;
    participantQuota?: int32;
    level?: CourseLevel;
    language?: string;
    trainingType?: TrainingType;
    customTrainingType?: string;
    isDisabilityFriendly: boolean;
    supportedDisabilityTypes: string[];
    minimumEducation?: string;
    minimumAge?: int32;
    maximumAge?: int32;
    cityCode?: string;
    fundingSource?: FundingSource;
    customFundingSource?: string;
    trainingBudget?: int32;
    contactPersonName?: string;
    contactPersonPhone?: string;
    /** Mockup-only: price in Rupiah. Absent/null means free. */
    price?: int32;
  }

  /**
   * Writable subset for creating a course — CourseForm's create mode
   * submits this, plus the institutionId the caller is authoring on
   * behalf of (their own institution, checked server-side). slug is
   * server-generated from title, instructor from the authenticated
   * session, status defaults to "draft", and modules start empty — none
   * of those are collected by the create form, so they're not writable
   * here. level/language default to "beginner"/"id" when omitted.
   */
  model CourseCreate {
    ...CourseUpdate;
    institutionId: ResourceId;
  }

  @route("/courses")
  @tag("Courses")
  interface CoursesApi {
    /** Lists courses in the catalog, optionally filtered by institution, publish status, or text search across title and short description. */
    @get
    @list
    list(
      ...PageParams,
      ...OrderByParam,
      ...SearchParam,
      @query institutionId?: ResourceId,
      @query status?: CourseStatus
    ): PagedResponse<Course> | ErrorResponse;

    /** Fetches one course by id, including its full module/lesson tree. */
    @get
    get(@path id: ResourceId): DataResponse<Course> | ErrorResponse;

    /**
     * Creates a draft course owned by the given institution, attributed to
     * the authenticated caller as instructor. See CourseCreate's doc
     * comment for which fields are server-derived.
     */
    @post
    create(@body body: CourseCreate): {
      @statusCode statusCode: 201;
      @header("Location")
      location: string;
      @body body: DataResponse<Course>;
    } | ErrorResponse;

    /** Updates a course's profile/schedule fields. See CourseUpdate's doc
     *  comment for what's excluded. */
    @patch
    update(@path id: ResourceId, @body body: CourseUpdate): DataResponse<Course> | ErrorResponse;

    /** Moves a draft/archived course to published, making it visible in the
     *  catalog. Dedicated action route rather than a `status` field on
     *  CourseUpdate, matching InstitutionRequestsApi's approve/reject shape. */
    @post
    @route("{id}/publish")
    publish(@path id: ResourceId): DataResponse<Course> | ErrorResponse;

    /** Moves a published course back to draft. */
    @post
    @route("{id}/unpublish")
    unpublish(@path id: ResourceId): DataResponse<Course> | ErrorResponse;
  }
}
