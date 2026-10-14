// Import order = tag/section order in the generated OpenAPI document
// (Scalar renders groups in this order). See scripts/enrich-tags.mjs for
// each section's description.
import "./shared/common.tsp";
import "./health.tsp";
import "./courses.tsp";
import "./course-content.tsp";
import "./course-instructors.tsp";
import "./enrollments.tsp";
import "./quizzes.tsp";
import "./assignments.tsp";
import "./certificates.tsp";
import "./certificate-settings.tsp";
import "./uploads.tsp";
import "./announcements.tsp";
import "./platform-settings.tsp";
import "./notifications.tsp";
import "./reports.tsp";
import "./telemetry.tsp";
import "./institutions.tsp";
import "./users.tsp";
import "./audit.tsp";

/**
 * LMS API contracts — single source of truth for shapes. The web mockup
 * (apps/web/lib/mock/*) types its fixtures against the generated schemas so
 * drift between mockup and contract is a typecheck error.
 *
 * Layout mirrors the vamios-core standard: `shared/common.tsp` carries the
 * cross-cutting envelopes (DataResponse / PagedResponse / ErrorResponse,
 * ResponseMeta, pagination + query params); domain files carry resources
 * and their operations. Scope discipline: model only what exists in the
 * product today — adding a model here is an API design decision, not a
 * filler exercise.
 */
@service(#{ title: "LMS Contracts" })
namespace Lms;
