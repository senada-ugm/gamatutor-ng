import "@typespec/http";
import "@typespec/rest";

import "./shared/common.tsp";

// NOTE: do NOT add `using TypeSpec;` — on this Windows setup it makes every
// builtin (string, utcDateTime, Lifecycle, ...) ambiguous between two
// resolutions of the std namespace. Lifecycle/visibility resolve fine via
// the http lib's index alone.
using TypeSpec.Http;
using TypeSpec.Rest;
using Lms.Common;

/**
 * Institution domain: registration requests, approved institutions, and
 * ownership grants. Declared inside `namespace Lms` (which merges with the
 * @service namespace in main.tsp) so the OpenAPI emitter picks these
 * operations up — root-level interfaces emit nothing.
 */
namespace Lms {
  /**
   * The account's global trust tier - the only real "role." Every other
   * capability (teaching a course, owning an institution, being enrolled
   * as a learner) is membership data, not a role: see InstitutionOwnership,
   * course-instructors.tsp's CourseInstructor, and enrollments.tsp's
   * Enrollment - all self-service, all acquired through normal product use
   * (request+approval, an invite, hitting enroll). "admin" is the one tier
   * that can't be self-acquired that way; it must be granted by an existing
   * admin, which is why it alone stays a stored role instead of a derived
   * join. (The web app's session has a separate AppSection concept for
   * which UI chrome/nav is showing - that's a navigation detail, not an
   * account attribute, and keeps its 4 values: student/instructor/
   * institution_owner/admin.)
   */
  enum UserRole {
    user: "user";
    admin: "admin";
  }

  enum InstitutionRequestStatus {
    pending: "pending";
    approved: "approved";
    rejected: "rejected";
  }

  /** Display copy of the requesting account, denormalized. */
  model RequesterInfo {
    name: string;
    email: string;
  }

  /** A user's request to register an institution on the platform. */
  model InstitutionRequest {
    @key
    id: ResourceId;
    institutionName: string;
    institutionType: string;
    description?: string;
    website?: string;
    email?: string;
    phone?: string;
    address?: string;
    /** Optional logo, uploaded via UploadsApi before submitting — same
     *  claim-on-approve lifecycle as Course.thumbnail (see approve()'s
     *  doc comment). */
    logo?: string | null;
    justification?: string;
    /** The account that submitted this — approving grants THEM ownership. */
    @visibility(Lifecycle.Read)
    requestedByUserId: ResourceId;
    @visibility(Lifecycle.Read)
    requestedByUser: RequesterInfo;
    @visibility(Lifecycle.Read)
    status: InstitutionRequestStatus;
    @visibility(Lifecycle.Read)
    createdAt: utcDateTime;
    @visibility(Lifecycle.Read)
    rejectionReason?: string;
  }

  /** Writable subset — what the submission form POSTs. */
  model InstitutionRequestCreate {
    institutionName: string;
    institutionType: string;
    description?: string;
    website?: string;
    email?: string;
    phone?: string;
    address?: string;
    logo?: string | null;
    justification?: string;
  }

  model InstitutionRequestReject {
    reason: string;
  }

  /** An approved institution — a training provider on the platform. */
  model RegisteredInstitution {
    @key
    id: ResourceId;
    name: string;
    institutionType: string;
    description?: string;
    website?: string;
    email?: string;
    phone?: string;
    address?: string;
    /** Optional logo — shown next to the institution's name wherever a
     *  course card credits its provider. Uploaded via UploadsApi
     *  (purpose "logo") the same way Course.thumbnail is. */
    logo?: string | null;
    /** Opaque free-form bag — key/value extension point. The API stores and
     *  returns it verbatim; the schema of the contents is the caller's. */
    metadata?: Record<unknown>;
    @visibility(Lifecycle.Read)
    status: "approved";
    @visibility(Lifecycle.Read)
    createdAt: utcDateTime;
  }

  /**
   * Writable subset for editing an approved institution's profile — the
   * owner/admin edit form submits this. institutionType, status and
   * createdAt are server-set and not included.
   */
  model InstitutionProfileUpdate {
    name: string;
    description?: string;
    website?: string;
    email?: string;
    phone?: string;
    address?: string;
    logo?: string | null;
    metadata?: Record<unknown>;
  }

  /**
   * Writable subset for an admin directly registering an institution —
   * the admin "add institution" form submits this. Distinct from
   * InstitutionRequestCreate: this skips the pending-request/approval
   * step entirely (an admin doesn't need to approve their own creation)
   * and the service layer grants the creating admin ownership immediately,
   * same "creation implies ownership" behavior InstitutionRequestsApi's
   * approve() already has.
   */
  model InstitutionCreate {
    name: string;
    institutionType: string;
    description?: string;
    website?: string;
    email?: string;
    phone?: string;
    address?: string;
    logo?: string | null;
    metadata?: Record<unknown>;
  }

  /**
   * The many-to-many join: this user administers this institution. A person
   * can hold several of these AND instruct at institutions they don't own
   * (course-grain instructor assignments are a separate concern).
   */
  model InstitutionOwnership {
    @key
    id: ResourceId;
    userId: ResourceId;
    institutionId: ResourceId;
    @visibility(Lifecycle.Read)
    grantedAt: utcDateTime;
  }

  model InstitutionOwnershipGrant {
    userId: ResourceId;
    institutionId: ResourceId;
  }

  @route("/institutions")
  @tag("Institutions")
  interface InstitutionsApi {
    /** Lists registered institutions, optionally filtered by text search across name, type, and description. */
    @get
    @list
    list(...PageParams, ...SearchParam): PagedResponse<RegisteredInstitution> | ErrorResponse;

    /** Fetches one registered institution by id. */
    @get
    get(@path id: ResourceId): DataResponse<RegisteredInstitution> | ErrorResponse;

    /**
     * Admin-only direct registration — grants the creating admin ownership
     * immediately. See InstitutionCreate's doc comment.
     */
    @post
    create(@body body: InstitutionCreate): {
      @statusCode statusCode: 201;
      @header("Location")
      location: string;
      @body body: DataResponse<RegisteredInstitution>;
    } | ErrorResponse;

    /**
     * Updates a registered institution's profile (name/contact/description)
     * — used by both the owner and admin institution detail pages.
     * institutionType, status and createdAt are immutable here.
     */
    @patch
    update(
      @path id: ResourceId,
      @body body: InstitutionProfileUpdate
    ): DataResponse<RegisteredInstitution> | ErrorResponse;
  }

  @route("/institution-requests")
  @tag("Institution Requests")
  interface InstitutionRequestsApi {
    /**
     * List requests, optionally filtered by status (admin review queue) or
     * by submitter (a non-admin's own "Permohonan Saya" — the server
     * forces this filter to the caller's own id for non-admins regardless
     * of what's passed here, so one account can never list another's).
     */
    @get
    @list
    list(
      ...PageParams,
      ...OrderByParam,
      ...SearchParam,
      @query status?: InstitutionRequestStatus,
      @query requestedByUserId?: ResourceId
    ): PagedResponse<InstitutionRequest> | ErrorResponse;

    /** Fetches one request. Non-admins may only view their own. */
    @get
    get(@path id: ResourceId): DataResponse<InstitutionRequest> | ErrorResponse;

    /** Creates a pending request attributed to the authenticated submitter. */
    @post
    create(@body body: InstitutionRequestCreate): {
      @statusCode statusCode: 201;
      @header("Location")
      location: string;
      @body body: DataResponse<InstitutionRequest>;
    } | ErrorResponse;

    /**
     * Approves a pending request: registers the institution AND grants the
     * requester ownership of it — the elevation step that turns a regular
     * account into an institution-scoped admin.
     */
    @post
    @route("{id}/approve")
    approve(@path id: ResourceId): DataResponse<RegisteredInstitution> | ErrorResponse;

    /** Rejects a pending request with a reason. Admin-only. */
    @post
    @route("{id}/reject")
    reject(
      @path id: ResourceId,
      @body body: InstitutionRequestReject
    ): DataResponse<InstitutionRequest> | ErrorResponse;
  }

  @route("/institution-ownerships")
  @tag("Institution Ownerships")
  interface InstitutionOwnershipsApi {
    /** Institutions a user owns (the owner workspace's scope source). */
    @get
    @list
    listByUser(@query userId: ResourceId): PagedResponse<InstitutionOwnership> | ErrorResponse;

    /** Idempotent grant — approving the same request twice won't double-join. */
    @post
    grant(@body body: InstitutionOwnershipGrant): DataResponse<InstitutionOwnership> | ErrorResponse;
  }
}
