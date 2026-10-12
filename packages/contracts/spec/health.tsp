import "@typespec/http";

using TypeSpec.Http;
using Lms.Common;

namespace Lms {
  /** Liveness probe payload — status reflects the database ping. */
  model HealthStatus {
    status: "ok" | "degraded";
    timestamp: utcDateTime;
  }

  @route("/health")
  /** Service liveness probe. Served at BOTH /health (bare, for infra
   *  probes/CI) and /v1/health (for the generated SDK, whose client
   *  baseUrl already carries the /v1 prefix) — one operation, two
   *  mounts; the alias is deliberately undocumented as a second path
   *  here. */
  @tag("Health")
  interface HealthApi {
    /** Returns service liveness plus the current server timestamp. */
    @get
    check(): DataResponse<HealthStatus>;
  }
}
