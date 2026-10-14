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

  model TelemetryDailyPoint {
    /** WIB calendar date, `yyyy-MM-dd`. */
    date: string;
    dwellSeconds: int32;
    /** Distinct learners with at least one event this day. */
    activeLearners: int32;
  }

  model TelemetryParticipantRow {
    user: ReportUser;
    totalDwellSeconds: int32;
    /** Logged events (slide views + heartbeats) — the interaction count. */
    events: int32;
    lastActiveAt?: utcDateTime;
  }

  /** Aggregated study-time analytics for one course, computed from the
   *  raw event log (Review note #15: "lama belajar dan waktu yang sering
   *  modulnya diakses"). All bucketing uses WIB (Asia/Jakarta) — the
   *  platform's audience is Indonesian primary-care doctors. */
  model CourseTelemetrySummary {
    courseId: ResourceId;
    totalDwellSeconds: int32;
    /** Median of the per-participant total dwell; 0 when nobody has
     *  studied yet. */
    medianParticipantDwellSeconds: int32;
    /** Distinct learners with at least one logged event. */
    activeParticipants: int32;
    /** 7 x 24 dwell seconds, day-major and Monday-first (index =
     *  dayOfWeek * 24 + hourOfDay, WIB). */
    heatmapDwellSeconds: int32[];
    /** Last 30 WIB calendar days, oldest first — zero-filled so charts
     *  render a continuous axis. */
    trend30d: TelemetryDailyPoint[];
    byParticipant: TelemetryParticipantRow[];
  }

  @route("/courses/{courseId}/telemetry-summary")
  @tag("Telemetry")
  interface CourseTelemetryApi {
    /** Study-time aggregates for the course report view. Course managers
     *  only — same gate as the course report itself. */
    @get
    get(@path courseId: ResourceId): DataResponse<CourseTelemetrySummary> | ErrorResponse;
  }
}
