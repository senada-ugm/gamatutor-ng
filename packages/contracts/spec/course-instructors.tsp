import "@typespec/http";
import "@typespec/rest";

import "./shared/common.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using Lms.Common;

/**
 * Course-instructor domain: the per-course instructor assignment/invite -
 * a join between a Course and a User, same shape lesson as
 * InstitutionOwnership (institution-level) but scoped one level down.
 */
namespace Lms {
  enum CourseInstructorRole {
    instructor: "instructor";
    coInstructor: "co_instructor";
  }

  enum CourseInstructorStatus {
    active: "active";
    pending: "pending";
  }

  /**
   * Denormalized display copy of the invited/assigned account - same
   * pattern as institutions.tsp's RequesterInfo, plus an id since the
   * invite-roster autocomplete needs one to key on.
   */
  model CourseInstructorUser {
    id: ResourceId;
    name: string;
    email: string;
  }

  model CourseInstructor {
    @key
    id: ResourceId;
    courseId: ResourceId;
    email: string;
    status: CourseInstructorStatus;
    role: CourseInstructorRole;
    @visibility(Lifecycle.Read)
    createdAt: utcDateTime;
    user: CourseInstructorUser;
  }

  /** Writable subset for inviting an instructor to a course. status is
   *  server-derived (active if the email already matches a real account,
   *  else pending until they sign up). */
  model CourseInstructorCreate {
    courseId: ResourceId;
    email: string;
    role?: CourseInstructorRole;
  }

  model CourseInstructorRoleUpdate {
    role: CourseInstructorRole;
  }

  @route("/course-instructors")
  @tag("Course Instructors")
  interface CourseInstructorsApi {
    /** Lists a course's instructors — active assignments and pending invites. */
    @get
    @list
    list(
      ...PageParams,
      ...OrderByParam,
      @query courseId: ResourceId
    ): PagedResponse<CourseInstructor> | ErrorResponse;

    /** The session user's own ACTIVE instructor assignments across all
     *  courses — backs the real isInstructor() derivation in the web app
     *  (which nav chrome shows, whether the catalog CTA appears). */
    @get
    @route("mine")
    listMine(...PageParams): PagedResponse<CourseInstructor> | ErrorResponse;

    /**
     * Instructors already teaching at least one OTHER course in the given
     * institution, deduped by email - powers the invite-form autocomplete
     * so an owner doesn't retype the same person's email for every course.
     */
    @get
    @route("institution-roster")
    institutionRoster(
      @query institutionId: ResourceId,
      @query excludeCourseId?: ResourceId
    ): PagedResponse<CourseInstructorUser> | ErrorResponse;

    /** Invites/adds an instructor. Admin-or-institution-owner only. */
    @post
    create(@body body: CourseInstructorCreate): {
      @statusCode statusCode: 201;
      @body body: DataResponse<CourseInstructor>;
    } | ErrorResponse;

    /** Changes an instructor's role (instructor / co_instructor). Admin-or-institution-owner only. */
    @patch
    @route("{id}/role")
    updateRole(@path id: ResourceId, @body body: CourseInstructorRoleUpdate): DataResponse<CourseInstructor> | ErrorResponse;

    /** Removes an instructor from a course. Admin-or-institution-owner only. */
    @delete
    remove(@path id: ResourceId): {
      @statusCode statusCode: 204;
    } | ErrorResponse;
  }
}
