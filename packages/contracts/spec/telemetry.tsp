import "@typespec/http";
import "@typespec/rest";

import "./shared/common.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using Lms.Common;

/**
 * Learning telemetry domain: tracks granular learner engagement per slide,
 * including dwell time, interaction events, and completion progress.
 */
namespace Lms {
  model TelemetryEventCreate {
    courseId: ResourceId;
    moduleId: string;
    slideId: string;
    eventType: string;
    dwellTimeSeconds?: int32;
    interactionData?: Record<unknown>;
  }

  model TelemetryEvent {
    id: ResourceId;
    userId: ResourceId;
    courseId: ResourceId;
    moduleId: string;
    slideId: string;
    eventType: string;
    dwellTimeSeconds: int32;
    createdAt: utcDateTime;
  }

  @route("/telemetry/events")
  @tag("Telemetry")
  interface TelemetryApi {
    /** Logs a slide interaction or dwell-time heartbeat event. */
    @post
    create(@body body: TelemetryEventCreate): {
      @statusCode statusCode: 201;
      @body body: DataResponse<TelemetryEvent>;
    } | ErrorResponse;
  }
}
