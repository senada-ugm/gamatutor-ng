import "@typespec/http";
import "@typespec/rest";

import "./shared/common.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using Lms.Common;

/**
 * Course-scoped announcements, authored by course managers (instructors/
 * owners/admin). Publishing fans out an in-app + email notification to
 * every active participant of the course (NotificationType
 * "announcement") — the one broadcast surface in the platform.
 */
namespace Lms {
  enum AnnouncementPriority {
    normal: "normal";
    high: "high";
  }

  model AnnouncementUser {
    id: ResourceId;
    name: string;
  }

  model Announcement {
    @key
    id: ResourceId;
    courseId: ResourceId;
    title: string;
    content: string;
    user: AnnouncementUser;
    /** Draft announcements stay invisible to participants. */
    isPublished: boolean;
    publishedAt?: utcDateTime;
    isPinned: boolean;
    priority: AnnouncementPriority;
    @visibility(Lifecycle.Read)
    createdAt: utcDateTime;
  }

  model AnnouncementCreate {
    courseId: ResourceId;
    title: string;
    content: string;
    isPublished?: boolean;
    isPinned?: boolean;
    priority?: AnnouncementPriority;
  }

  @route("/courses/{courseId}/announcements")
  @tag("Announcements")
  interface CourseAnnouncementsApi {
    /** Lists a course's published announcements (managers also see
     *  drafts), pinned first then newest. */
    @get
    @list
    list(@path courseId: ResourceId, ...PageParams, ...OrderByParam): PagedResponse<Announcement> | ErrorResponse;

    /** Creates an announcement. Course managers only; publishing
     *  notifies every active participant. */
    @post
    create(@path courseId: ResourceId, @body body: AnnouncementCreate): {
      @statusCode statusCode: 201;
      @body body: DataResponse<Announcement>;
    } | ErrorResponse;
  }

  /** Id-scoped actions — separate interface so the course-scoped route
   *  above doesn't demand a courseId path param on each of these. */
  @route("/announcements")
  @tag("Announcements")
  interface AnnouncementApi {
    /** Pins (managers only). */
    @post
    @route("{id}/pin")
    pin(@path id: ResourceId): DataResponse<Announcement> | ErrorResponse;

    @post
    @route("{id}/unpin")
    unpin(@path id: ResourceId): DataResponse<Announcement> | ErrorResponse;

    /** Publishes a draft (managers only) — triggers the notification
     *  fan-out. */
    @post
    @route("{id}/publish")
    publish(@path id: ResourceId): DataResponse<Announcement> | ErrorResponse;

    /** Deletes an announcement (managers only). */
    @delete
    delete(@path id: ResourceId): void | ErrorResponse;
  }
}
