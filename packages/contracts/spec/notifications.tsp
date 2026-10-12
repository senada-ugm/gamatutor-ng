import "@typespec/http";
import "@typespec/rest";

import "./shared/common.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using Lms.Common;

/**
 * In-app notification center + transactional email. Rows are written by
 * the backend at the business moments that otherwise require the user to
 * poll: selection/failure results, payment confirmation, instructor
 * grading, certificate issuance. Every write also sends an email (via
 * lib/email.ts — console fallback in dev); a failed email/notification
 * write must never fail the business action that triggered it.
 */
namespace Lms {
  /** The business moments that emit a notification. A string enum so the
   *  frontend can badge/filter without a contract change per new event. */
  enum NotificationType {
    announcement: "announcement";
    enrollmentSelected: "enrollment_selected";
    enrollmentFailed: "enrollment_failed";
    orderPaid: "order_paid";
    orderRefunded: "order_refunded";
    assignmentGraded: "assignment_graded";
    quizGraded: "quiz_graded";
    certificateIssued: "certificate_issued";
  }

  model Notification {
    @key
    id: ResourceId;
    userId: ResourceId;
    type: NotificationType;
    title: string;
    body?: string;
    /** App-relative route to the subject, e.g. /learn/{courseId} */
    link?: string;
    @visibility(Lifecycle.Read)
    readAt?: utcDateTime;
    @visibility(Lifecycle.Read)
    createdAt: utcDateTime;
  }

  @route("/notifications")
  @tag("Notifications")
  interface NotificationsApi {
    /** Lists the caller's notifications, newest first. */
    @get
    @list
    list(
      ...PageParams,
      ...OrderByParam,
      @query unreadOnly?: boolean
    ): PagedResponse<Notification> | ErrorResponse;

    /** Marks one notification read. Own notifications only. */
    @post
    @route("{id}/read")
    markRead(@path id: ResourceId): DataResponse<Notification> | ErrorResponse;

    /** Marks every unread notification of the caller read. */
    @post
    @route("read-all")
    markAllRead(): {
      @statusCode statusCode: 204;
    } | ErrorResponse;
  }
}
