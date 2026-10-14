import "@typespec/http";
import "@typespec/rest";

import "./shared/common.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using Lms.Common;

/**
 * A learner's saved courses — a plain user x course join. Own rows only;
 * there is no admin view into anyone's wishlist.
 */
namespace Lms {
  /** Just what the wishlist cards render — not the full Course (no
   *  module tree, no pricing detail). */
  model WishlistCourseSummary {
    id: ResourceId;
    title: string;
    shortDescription?: string;
    thumbnail?: string;
    courseType: string;
    level: string;
    status: string;
    institutionId: ResourceId;
    /** Integer Rupiah; null/undefined means free. */
    price?: int32;
  }

  model WishlistItem {
    @key
    id: ResourceId;
    userId: ResourceId;
    courseId: ResourceId;
    @visibility(Lifecycle.Read)
    course?: WishlistCourseSummary;
    @visibility(Lifecycle.Read)
    createdAt: utcDateTime;
  }

  model WishlistAdd {
    courseId: ResourceId;
  }

  @route("/wishlist")
  @tag("Wishlist")
  interface WishlistApi {
    /** Lists the caller's wishlist, newest first. */
    @get
    @list
    list(...PageParams, ...OrderByParam): PagedResponse<WishlistItem> | ErrorResponse;

    /** Saves a course (idempotent — already-saved returns the existing
     *  row). Draft/unpublished courses cannot be saved. */
    @post
    add(@body body: WishlistAdd): {
      @statusCode statusCode: 201;
      @body body: DataResponse<WishlistItem>;
    } | ErrorResponse;

    /** Removes a course from the caller's wishlist. */
    @delete
    @route("{courseId}")
    remove(@path courseId: ResourceId): void | ErrorResponse;
  }
}
