import "@typespec/http";
import "@typespec/rest";
import "./shared/common.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using Lms.Common;

/**
 * Audit log domain: an append-only trail of privileged actions
 * (suspensions, request approvals/rejections, ownership grants, reference
 * edits). Written by the routes that perform the action; reads are
 * admin-only. No update/delete operations — history is history.
 */
namespace Lms {
  model AuditLogEntry {
    @key
    id: ResourceId;
    /** The admin account that performed the action. */
    @visibility(Lifecycle.Read)
    actorUserId: ResourceId;
    /** Dot-namespaced action, e.g. "user.suspend". */
    @visibility(Lifecycle.Read)
    action: string;
    @visibility(Lifecycle.Read)
    entityType: string;
    @visibility(Lifecycle.Read)
    entityId: ResourceId;
    /** Action-specific free-form context (reasons, related ids). */
    @visibility(Lifecycle.Read)
    metadata?: Record<unknown>;
    @visibility(Lifecycle.Read)
    createdAt: utcDateTime;
  }

  @route("/audit-log")
  /** Append-only trail of privileged actions. Admin-only. */
  @tag("Audit Log")
  interface AuditLogApi {
    /** Lists recorded actions, newest first. */
    @get
    @list
    list(...PageParams, ...SearchParam): PagedResponse<AuditLogEntry> | ErrorResponse;
  }
}
