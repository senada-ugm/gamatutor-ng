import "@typespec/http";
import "@typespec/rest";

import "./shared/common.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using Lms.Common;

/**
 * Assignment domain: file/text submissions graded by an instructor.
 * Resubmission rule (locked-in product decision): a student may overwrite
 * their submission freely while it's `draft`/`submitted`; once `graded`,
 * the instructor must first flip it to `returned` (see
 * `AssignmentSubmissionApi.reopen`) before a new submission is accepted -
 * see submitAssignment's doc comment in the service for the enforcement.
 */
namespace Lms {
  enum AssignmentSubmissionStatus {
    draft: "draft";
    submitted: "submitted";
    graded: "graded";
    returned: "returned";
  }

  model AssignmentAttachment {
    uploadId: string;
    url: string;
    name: string;
    size: int32;
    mimeType: string;
  }

  model Assignment {
    @key
    id: ResourceId;
    courseId: ResourceId;
    lessonId?: ResourceId;
    title: string;
    description?: string;
    instructions?: string;
    maxScore: int32;
    dueDate?: utcDateTime;
    allowLateSubmission: boolean;
    /** Percent of the score deducted from late submissions at grading time. */    lateSubmissionPenalty: int32;
    allowedFileTypes: string[];
    maxFileSize?: int32;
    maxFiles: int32;
    isActive: boolean;
    /** Computed on read - avoids the editor's assignment list making one
     *  request per row just to show "N dikumpulkan". */
    @visibility(Lifecycle.Read)
    submissionCount: int32;
    @visibility(Lifecycle.Read)
    createdAt: utcDateTime;
  }

  model AssignmentCreate {
    lessonId?: ResourceId;
    title: string;
    description?: string;
    instructions?: string;
    maxScore?: int32;
    dueDate?: utcDateTime;
    allowLateSubmission?: boolean;
    lateSubmissionPenalty?: int32;
    allowedFileTypes?: string[];
    maxFileSize?: int32;
    maxFiles?: int32;
    isActive?: boolean;
  }

  model AssignmentUpdate {
    lessonId?: ResourceId;
    title?: string;
    description?: string;
    instructions?: string;
    maxScore?: int32;
    dueDate?: utcDateTime;
    allowLateSubmission?: boolean;
    lateSubmissionPenalty?: int32;
    allowedFileTypes?: string[];
    maxFileSize?: int32;
    maxFiles?: int32;
    isActive?: boolean;
  }

  model AssignmentSubmissionUser {
    id: ResourceId;
    name: string;
    email: string;
  }

  model AssignmentSubmission {
    @key
    id: ResourceId;
    assignmentId: ResourceId;
    content?: string;
    attachments: AssignmentAttachment[];
    status: AssignmentSubmissionStatus;
    score?: int32;
    feedback?: string;
    @visibility(Lifecycle.Read)
    submittedAt: utcDateTime;
    @visibility(Lifecycle.Read)
    gradedAt?: utcDateTime;
    isLate: boolean;
    user: AssignmentSubmissionUser;
  }

  model AssignmentSubmissionCreate {
    content?: string;
    attachmentUploadIds?: string[];
  }

  model AssignmentGrade {
    score: int32;
    feedback?: string;
  }

  @route("/courses/{courseId}/assignments")
  @tag("Assignments")
  interface CourseAssignmentsApi {
    /** Lists a course's assignments with per-assignment submission counts. */
    @get
    @list
    list(@path courseId: ResourceId, ...PageParams): PagedResponse<Assignment> | ErrorResponse;

    /** Creates a new assignment inside a course. Course-management only. */
    @post
    create(@path courseId: ResourceId, @body body: AssignmentCreate): {
      @statusCode statusCode: 201;
      @body body: DataResponse<Assignment>;
    } | ErrorResponse;
  }

  @route("/assignments/{id}")
  @tag("Assignments")
  interface AssignmentsApi {
    /** Fetches one assignment by id, including its current submission count. */
    @get
    get(@path id: ResourceId): DataResponse<Assignment> | ErrorResponse;

    /** Updates an assignment's authoring fields (title, instructions, deadline, limits). Course-management only. */
    @patch
    update(@path id: ResourceId, @body body: AssignmentUpdate): DataResponse<Assignment> | ErrorResponse;

    /** Deletes an assignment and, by cascade, its submissions. Course-management only. */
    @delete
    delete(@path id: ResourceId): {
      @statusCode statusCode: 204;
    } | ErrorResponse;
  }

  @route("/assignments/{assignmentId}/submissions")
  @tag("Assignments")
  interface AssignmentSubmissionsApi {
    /** Course managers see every submission; anyone else sees only their
     *  own (0 or 1 row) - the same endpoint backs both the grading list
     *  and a student's "my submission" lookup. */
    @get
    @list
    list(@path assignmentId: ResourceId, ...PageParams): PagedResponse<AssignmentSubmission> | ErrorResponse;

    /** Creates or overwrites the caller's own submission. Rejected with a
     *  conflict if their existing submission is `graded` - the instructor
     *  must `return` it first. */
    @post
    submit(@path assignmentId: ResourceId, @body body: AssignmentSubmissionCreate): {
      @statusCode statusCode: 201;
      @body body: DataResponse<AssignmentSubmission>;
    } | ErrorResponse;
  }

  @route("/assignment-submissions/{id}")
  @tag("Assignments")
  interface AssignmentSubmissionApi {
    /** Fetches a single submission by id, including score and feedback. */
    @get
    get(@path id: ResourceId): DataResponse<AssignmentSubmission> | ErrorResponse;

    /** Course-management only. Sets status to `graded`. */
    @post
    @route("grade")
    grade(@path id: ResourceId, @body body: AssignmentGrade): DataResponse<AssignmentSubmission> | ErrorResponse;

    /** Course-management only. Reopens a `graded` submission for
     *  resubmission by flipping status to `returned`. */
    @post
    @route("return")
    reopen(@path id: ResourceId): DataResponse<AssignmentSubmission> | ErrorResponse;
  }
}
