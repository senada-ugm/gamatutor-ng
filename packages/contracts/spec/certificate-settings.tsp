import "@typespec/http";
import "@typespec/rest";

import "./shared/common.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using Lms.Common;

/**
 * Certificate settings domain: per-course certificate template
 * configuration (signatures). A dedicated resource/table rather than a
 * JSONB column bolted onto Course - matches this codebase's "one domain,
 * one module" shape and keeps signature edits independent of course-row
 * writes.
 */
namespace Lms {
  enum CertificateSignaturePlacement {
    left: "left";
    center: "center";
    right: "right";
  }

  model CertificateSignature {
    id: int32;
    name: string;
    title?: string;
    signatureUrl?: string;
    placement: CertificateSignaturePlacement;
  }

  model CertificateSettings {
    courseId: ResourceId;
    signatures: CertificateSignature[];
    @visibility(Lifecycle.Read)
    updatedAt: utcDateTime;
  }

  model CertificateSettingsUpdate {
    signatures: CertificateSignature[];
  }

  @route("/courses/{courseId}/certificate-settings")
  @tag("Certificate Settings")
  interface CertificateSettingsApi {
    /** Fetches a course's certificate template settings (signatures). */
    @get
    get(@path courseId: ResourceId): DataResponse<CertificateSettings> | ErrorResponse;

    /** Replaces the certificate's signature list. Course-management only. */
    @patch
    update(@path courseId: ResourceId, @body body: CertificateSettingsUpdate): DataResponse<CertificateSettings> | ErrorResponse;
  }
}
