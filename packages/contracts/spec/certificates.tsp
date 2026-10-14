import "@typespec/http";
import "@typespec/rest";

import "./shared/common.tsp";
import "./certificate-settings.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using Lms.Common;

/**
 * Certificate domain: an issued certificate's structured metadata (number,
 * verification code, recipient/course/institution display info, custom
 * fields, signatures). The server stores metadata only - rendering and
 * browser print/export stays entirely client-side
 * (certificate-template.tsx), no server-side PDF pipeline.
 */
namespace Lms {
  model CertificateUser {
    name: string;
    email: string;
  }

  model CertificateCourse {
    title: string;
    certificateSignatures?: CertificateSignature[];
  }

  model CertificateInstitution {
    name: string;
  }

  model Certificate {
    @key
    id: ResourceId;
    enrollmentId: ResourceId;
    courseId: ResourceId;
    userId: ResourceId;
    certificateNumber: string;
    verificationCode: string;
    title: string;
    description?: string;
    customFields: Record<string>;
    @visibility(Lifecycle.Read)
    issuedAt: utcDateTime;
    user: CertificateUser;
    course: CertificateCourse;
    institution: CertificateInstitution;
  }

  model CertificateIssue {
    enrollmentId: ResourceId;
    title?: string;
    description?: string;
    customFields?: Record<string>;
  }

  @route("/certificates")
  @tag("Certificates")
  interface CertificatesApi {
    /** Fetches a certificate by id. Requires the recipient, an admin, or a course manager — the public path is /certificates/verify. */
    @get
    get(@path id: ResourceId): DataResponse<Certificate> | ErrorResponse;

    /** Public lookup by verification code or certificate number - no auth,
     *  same as the certificate-verify page's public search. */
    @get
    @route("verify")
    verify(@query code: string): DataResponse<Certificate> | ErrorResponse;
  }

  @route("/courses/{courseId}/certificates")
  @tag("Certificates")
  interface CourseCertificatesApi {
    /** Issues a certificate for a graduated enrollment. Course-management
     *  only. */
    @post
    issue(@path courseId: ResourceId, @body body: CertificateIssue): {
      @statusCode statusCode: 201;
      @body body: DataResponse<Certificate>;
    } | ErrorResponse;
  }
}
