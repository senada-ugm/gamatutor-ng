import "@typespec/http";
import "@typespec/rest";

import "./shared/common.tsp";
import "./institutions.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using Lms.Common;

/**
 * User/account domain: the canonical identity every other domain
 * references informally today — InstitutionRequest.requestedByUserId,
 * InstitutionOwnership.userId, mockCourseInstructors[].user,
 * participantProfiles, MockPlatformUser. There is no other model of "an
 * account" in the contracts yet; this is it.
 */
namespace Lms {
  enum AccountStatus {
    active: "active";
    suspended: "suspended";
  }

  /** A platform account — the identity behind every role. */
  model User {
    @key
    id: ResourceId;
    name: string;
    email: string;
    /** Global account role only — institution ownership is a separate join
     *  (InstitutionOwnership), not a role value. */
    role: UserRole;
    @visibility(Lifecycle.Read)
    status: AccountStatus;
    @visibility(Lifecycle.Read)
    joinedAt: utcDateTime;
    @visibility(Lifecycle.Read)
    suspendedAt?: utcDateTime;
    @visibility(Lifecycle.Read)
    suspendedReason?: string;
  }

  model UserSuspend {
    reason: string;
  }

  model UserCapabilities {
    userId: ResourceId;
    ownedInstitutionIds: ResourceId[];
    /** True when the user holds at least one ACTIVE course-instructor assignment. */
    isInstructor: boolean;
  }

  @route("/users")
  @tag("Users")
  interface UsersApi {
    /** Lists platform accounts with role/status filters and search. Admin-only. */
    @get
    @list
    list(
      ...PageParams,
      ...OrderByParam,
      ...SearchParam,
      @query role?: UserRole,
      @query status?: AccountStatus
    ): PagedResponse<User> | ErrorResponse;

    /** Fetches one platform account. Admin-only. */
    @get
    get(@path id: ResourceId): DataResponse<User> | ErrorResponse;

    /** Suspends an account with a reason, blocking sign-in. Admin-only. */
    @post
    @route("{id}/suspend")
    suspend(@path id: ResourceId, @body body: UserSuspend): DataResponse<User> | ErrorResponse;

    /** Re-activates a suspended account, clearing suspension bookkeeping. Admin-only. */
    @post
    @route("{id}/reactivate")
    reactivate(@path id: ResourceId): DataResponse<User> | ErrorResponse;

    /** Batch capability lookup backing the admin user-management panel's
     *  per-row ownership/instructor badges — one call per visible page of
     *  users instead of N per-user fetches. Admin-only. */
    @get
    @route("/user-capabilities")
    capabilities(@query userIds: string): DataResponse<UserCapabilities[]> | ErrorResponse;
  }
}
