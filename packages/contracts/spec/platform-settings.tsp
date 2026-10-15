import "@typespec/http";
import "@typespec/rest";

import "./shared/common.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using Lms.Common;

/**
 * Platform-wide operational settings, admin-managed. Stored as one
 * settings row.
 * "platform_settings.update"). allowInstitutionRequests is enforced
 * server-side (the self-service request route rejects while off);
 * maintenanceMode is persisted for the kill-switch UI — sign-in gating
 * is NOT wired yet (see the route comment).
 */
namespace Lms {
  model PlatformSettings {
    platformName: string;
    supportEmail: string;
    supportPhone?: string;
    maintenanceMode: boolean;
    allowInstitutionRequests: boolean;
    @minValue(1)
    @maxValue(120)
    certificateValidityMonths: int32;
    @visibility(Lifecycle.Read)
    updatedAt: utcDateTime;
  }

  model PlatformSettingsUpdate {
    platformName?: string;
    supportEmail?: string;
    supportPhone?: string | null;
    maintenanceMode?: boolean;
    allowInstitutionRequests?: boolean;
    certificateValidityMonths?: int32;
  }

  @route("/platform-settings")
  @tag("Platform Settings")
  interface PlatformSettingsApi {
    /** Reads the platform settings. Admin only. */
    @get
    get(): DataResponse<PlatformSettings> | ErrorResponse;

    /** Updates fields. Admin only. */
    @patch
    update(@body body: PlatformSettingsUpdate): DataResponse<PlatformSettings> | ErrorResponse;
  }
}
