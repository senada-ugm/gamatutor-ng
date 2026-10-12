import "@typespec/http";
import "@typespec/rest";

using Http;
using TypeSpec.Rest;

/**
 * Standard schemas, envelopes, parameters shared across all LMS API specs.
 *
 * Adapted from the VAMIOS vamios-core contract standard (C:\dev\VAMIOS\vamios-core
 * packages/contracts/spec/shared/common.tsp), de-tenanted for the LMS's
 * single shared marketplace. Deliberately NOT carried over: cursor
 * pagination, batch/webhook/event envelopes, tenant path params, cache and
 * rate-limit headers — add them when a real need shows up, not before.
 */
namespace Lms.Common;

/**
 * Standard page-based pagination links for easy client-side API navigation.
 */
model PageLinks {
  /** The URL for the first page of results. */
  first: string;

  /** The URL for the previous page of results (null if on the first page). */
  @prevLink
  previous?: string;

  /** The URL for the next page of results (null if on the last page). */
  @nextLink
  next?: string;

  /** The URL for the last page of results. */
  last: string;
}

/**
 * Standard page-based pagination metadata.
 */
model PagePagination {
  /** The current page number (1-indexed). */
  page: int32;

  /** The number of items returned per page. */
  pageSize: int32;

  /** The total number of pages available. */
  totalPages: int32;

  /** The total number of items matching the query across all pages. */
  totalCount: int64;

  /** Indicates if there is a subsequent page of results. */
  hasNext: boolean;

  /** Indicates if there is a preceding page of results. */
  hasPrevious: boolean;

  /** Navigation links for traversing pages. */
  links: PageLinks;

  /** The original requested page size if it was capped by the server. */
  requestedPageSize?: int32;
}

/**
 * Metadata envelope included in all API responses.
 */
model ResponseMeta {
  /** Unique tracing identifier for request lifecycle debugging. */
  requestId: string;

  /** Timestamp representing when the response was processed. */
  timestamp: utcDateTime;

  /** Active version identifier of the serving endpoint. */
  apiVersion?: string;

  /** Total elapsed backend execution duration in milliseconds. */
  durationMs?: int64;
}

/**
 * Warning object included in responses representing deprecation or usage notices.
 */
model Warning {
  /** The unique identifier of the warning code. */
  code: string;

  /** Readable text content specifying the warning trigger. */
  message: string;

  /** Sunset date when the deprecated endpoint or API will be deactivated. */
  sunsetDate?: utcDateTime;

  /** Recommendation of an alternative endpoint or API pattern. */
  alternative?: string;

  /** Documentation index link detailing the warning scenario. */
  documentationUrl?: string;
}

/**
 * Standard single resource response envelope.
 */
model DataResponse<T> {
  /** The raw payload representation. */
  data: T;

  /** Trace metadata. */
  meta: ResponseMeta;

  /** Minor warning list. */
  warnings?: Warning[];
}

/**
 * Standard page-based paginated response envelope.
 */
model PagedResponse<T> {
  /** The list of resources for the current page. */
  @pageItems
  data: T[];

  /** Pagination details and navigation links. */
  pagination: PagePagination;

  /** Response tracing metadata. */
  meta: ResponseMeta;

  /** Minor warning list. */
  warnings?: Warning[];
}

/**
 * Detailed validation or sub-error metadata representing individual model errors.
 */
model ErrorDetail {
  /** The specific schema path or request parameter field that failed validation. */
  field?: string;

  /** The machine-readable error sub-code identifying the validation rule that was violated. */
  code: string;

  /** A descriptive message explaining why the field failed validation. */
  message: string;

  /** Optional context-specific metadata detailing the validation violation constraints. */
  metadata?: Record<unknown>;
}

/**
 * Standard error container object.
 */
model ErrorObject {
  /** Machine-readable error code. */
  code: string;

  /** Human-readable explanation of the error. */
  message: string;

  /** Individual field validation failure messages. */
  details?: ErrorDetail[];

  /** Unique request trace identifier for troubleshooting. */
  requestId: string;

  /** Link pointing to the troubleshooting manual. */
  documentationUrl?: string;
}

/**
 * Standard error response envelope returned on non-2xx failures.
 */
@error
model ErrorResponse {
  /** The structured error detail container. */
  error: ErrorObject;
}

/**
 * Standard HTTP API error codes.
 */
enum StandardErrorCode {
  /** Malformed syntax or invalid request parameters. */
  badRequest: "badRequest",

  /** Parameter or request payload structural validation failure. */
  validationError: "validationError",

  /** Request lacks valid credentials. */
  unauthorized: "unauthorized",

  /** Token credentials are expired. */
  tokenExpired: "tokenExpired",

  /** Authenticated user lacks access to this resource. */
  forbidden: "forbidden",

  /** Missing required roles or capabilities to execute actions. */
  insufficientPermissions: "insufficientPermissions",

  /** Resource target was not found. */
  notFound: "notFound",

  /** Precondition conflict or lock issues. */
  conflict: "conflict",

  /** An active entry with similar keys already exists. */
  duplicate: "duplicate",

  /** Syntactically valid request that cannot be processed semantically. */
  unprocessableEntity: "unprocessableEntity",

  /** Request limits exceeded for this window. */
  rateLimitExceeded: "rateLimitExceeded",

  /** Unexpected backend fault. */
  internalError: "internalError",

  /** Service is temporarily offline or processing too high load. */
  serviceUnavailable: "serviceUnavailable",
}

/**
 * Standard validation error codes.
 */
enum ValidationErrorCode {
  /** Parameter is required but missing. */
  required: "required",

  /** Data content does not match pattern constraints. */
  invalidFormat: "invalidFormat",

  /** The datatype format does not match the declaration. */
  invalidType: "invalidType",

  /** Field index is outside acceptable bounds. */
  outOfRange: "outOfRange",

  /** Text string is below minimum required size bounds. */
  tooShort: "tooShort",

  /** Text string exceeds maximum allowed size bounds. */
  tooLong: "tooLong",

  /** Value is duplicate and conflicts with database constraints. */
  alreadyExists: "alreadyExists",

  /** Specified foreign key identifier not found in backend registry. */
  notFound: "notFound",
}

/**
 * Reusable page-based query parameters.
 */
model PageParams {
  /** The page index to retrieve (default: 1). */
  @pageIndex
  @query
  page?: int32 = 1;

  /** The maximum number of records to return on a page (default: 50). */
  @pageSize
  @query
  pageSize?: int32 = 50;
}

/**
 * Reusable query parameter for ordering/sorting results.
 */
model OrderByParam {
  /** Sort order configuration matching standard patterns (e.g. `createdAt:desc`). */
  @query
  orderBy?: string;
}

/**
 * Reusable query parameters for full-text search.
 */
model SearchParam {
  /** Query string matching wildcard terms. */
  @query
  search?: string;

  /** Short query alias parameter. */
  @query
  q?: string;
}

/**
 * Standard type-safe prefixed resource identifier scalar (e.g. `usr_x1Y2`,
 * `ins_aBc3`). Mock fixtures still use readable slugs like "institution-1"
 * — the real API mints prefixed ids.
 */
@pattern("^[a-z]{2,5}_[a-zA-Z0-9]+$")
scalar ResourceId extends string;
