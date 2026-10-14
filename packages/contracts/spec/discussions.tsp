import "@typespec/http";
import "@typespec/rest";

import "./shared/common.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using Lms.Common;

/**
 * Discussion domain: a course (optionally lesson-scoped) Q&A thread with
 * nested replies. replyCount/lastReplyAt are computed on read, not
 * stored. A deleted reply is soft-deleted (content
 * replaced, isDeleted flagged) so its position in the reply tree survives
 * for any replies nested under it.
 */
namespace Lms {
  model DiscussionUser {
    id: ResourceId;
    name: string;
    email: string;
  }

  model Discussion {
    @key
    id: ResourceId;
    courseId: ResourceId;
    lessonId?: ResourceId;
    title: string;
    content: string;
    isPinned: boolean;
    isClosed: boolean;
    isResolved: boolean;
    @visibility(Lifecycle.Read)
    viewCount: int32;
    @visibility(Lifecycle.Read)
    replyCount: int32;
    @visibility(Lifecycle.Read)
    lastReplyAt?: utcDateTime;
    @visibility(Lifecycle.Read)
    createdAt: utcDateTime;
    @visibility(Lifecycle.Read)
    updatedAt: utcDateTime;
    user: DiscussionUser;
    lastReplyByUser?: DiscussionUser;
  }

  model DiscussionCreate {
    lessonId?: ResourceId;
    title: string;
    content: string;
  }

  model DiscussionReply {
    @key
    id: ResourceId;
    discussionId: ResourceId;
    parentReplyId?: ResourceId;
    content: string;
    isDeleted: boolean;
    @visibility(Lifecycle.Read)
    createdAt: utcDateTime;
    @visibility(Lifecycle.Read)
    updatedAt: utcDateTime;
    user: DiscussionUser;
  }

  model DiscussionReplyCreate {
    content: string;
    parentReplyId?: ResourceId;
  }

  model DiscussionDetail extends Discussion {
    replies: DiscussionReply[];
  }

  @route("/courses/{courseId}/discussions")
  @tag("Discussions")
  interface CourseDiscussionsApi {
    /** Lists a course's discussion threads, pinned first then most recent activity. */
    @get
    @list
    list(@path courseId: ResourceId, @query lessonId?: ResourceId, ...PageParams): PagedResponse<Discussion> | ErrorResponse;

    /** Creates a discussion thread. Requires an active enrollment (managers bypass). */
    @post
    create(@path courseId: ResourceId, @body body: DiscussionCreate): {
      @statusCode statusCode: 201;
      @body body: DataResponse<DiscussionDetail>;
    } | ErrorResponse;
  }

  @route("/discussions/{id}")
  @tag("Discussions")
  interface DiscussionsApi {
    /** Increments viewCount as a side effect, same as opening a thread in
     *  the UI always does. */
    @get
    get(@path id: ResourceId): DataResponse<DiscussionDetail> | ErrorResponse;

    /** Deletes a thread. Allowed for its author or course managers. */
    @delete
    delete(@path id: ResourceId): {
      @statusCode statusCode: 204;
    } | ErrorResponse;

    /** Pins a thread to the top of the course's list. Course managers only. */
    @post
    @route("pin")
    pin(@path id: ResourceId): DataResponse<Discussion> | ErrorResponse;

    /** Removes a thread's pin. Course managers only. */
    @post
    @route("unpin")
    unpin(@path id: ResourceId): DataResponse<Discussion> | ErrorResponse;

    /** Locks a thread against new replies. Course managers only. */
    @post
    @route("close")
    close(@path id: ResourceId): DataResponse<Discussion> | ErrorResponse;

    /** Reopens a closed thread. Course managers only. */
    @post
    @route("reopen")
    reopen(@path id: ResourceId): DataResponse<Discussion> | ErrorResponse;

    /** Marks a thread resolved. Author or course managers. */
    @post
    @route("resolve")
    resolve(@path id: ResourceId): DataResponse<Discussion> | ErrorResponse;

    /** Clears a thread's resolved mark. Author or course managers. */
    @post
    @route("unresolve")
    unresolve(@path id: ResourceId): DataResponse<Discussion> | ErrorResponse;

    /** Adds a reply. Requires an active enrollment (managers bypass); closed threads reject replies. */
    @post
    @route("replies")
    reply(@path id: ResourceId, @body body: DiscussionReplyCreate): {
      @statusCode statusCode: 201;
      @body body: DataResponse<DiscussionReply>;
    } | ErrorResponse;
  }

  @route("/discussions/{discussionId}/replies/{id}")
  @tag("Discussions")
  interface DiscussionRepliesApi {
    /** Soft-delete: content is replaced and isDeleted flagged, the row
     *  stays so nested replies keep their place in the tree. */
    @delete
    delete(@path discussionId: ResourceId, @path id: ResourceId): {
      @statusCode statusCode: 204;
    } | ErrorResponse;
  }
}
