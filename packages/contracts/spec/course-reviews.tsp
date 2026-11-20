import "@typespec/http";
import "./shared/common.tsp";

using TypeSpec.Http;

namespace Lms {
  model CourseReview {
    id: string;
    courseId: string;
    userId: string;
    userName: string;
    @minValue(1)
    @maxValue(5)
    rating: int32;
    review?: string;
    suggestion?: string;
    createdAt: utcDateTime;
    updatedAt: utcDateTime;
  }

  model CourseReviewSummary {
    averageRating: float64;
    totalReviews: int32;
    myReview?: CourseReview;
  }

  model CourseReviewUpsert {
    @minValue(1)
    @maxValue(5)
    rating: int32;
    @maxLength(2000)
    review?: string;
    @maxLength(2000)
    suggestion?: string;
  }

  @route("/courses/{courseId}/reviews")
  @tag("CourseReviews")
  interface CourseReviewsApi {
    @get
    @summary("List course reviews")
    list(
      @path courseId: string,
      ...Common.PageParams,
    ): Common.PagedResponse<CourseReview> | Common.ErrorResponse;

    @get
    @route("/summary")
    @summary("Get course review summary")
    summary(@path courseId: string): Common.DataResponse<CourseReviewSummary> | Common.ErrorResponse;

    @put
    @route("/mine")
    @summary("Create or update the signed-in user's course review")
    upsertMine(
      @path courseId: string,
      @body body: CourseReviewUpsert,
    ): Common.DataResponse<CourseReview> | Common.ErrorResponse;
  }
}
