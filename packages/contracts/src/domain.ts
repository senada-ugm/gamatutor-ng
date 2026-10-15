/**
 * Authored surface of @workspace/contracts — named re-exports of the
 * schemas generated from spec/. Consumers import from here
 * (`@workspace/contracts/domain`), never from ../gen directly, so the
 * generator's output shape stays an implementation detail.
 *
 * Regenerate with `pnpm --filter @workspace/contracts build` after any
 * spec/ edit. Never hand-edit gen/.
 *
 * hey-api (unlike the previous openapi-typescript pipeline) flattens
 * TypeSpec namespace prefixes: `Common.ResponseMeta` -> `CommonResponseMeta`,
 * and emits enums as JS objects, hence the value exports at the bottom.
 */
import type {
  AccountStatus,
  Certificate,
  CertificateCourse,
  CertificateInstitution,
  CertificateIssue,
  CertificateSettings,
  CertificateSettingsUpdate,
  CertificateSignature,
  CertificateSignaturePlacement,
  CertificateUser,
  CertificationEntry,
  Announcement,
  AnnouncementCreate,
  AnnouncementPriority,
  CommonErrorDetail,
  CommonErrorObject,
  CommonErrorResponse,
  CommonPageLinks,
  CommonPagePagination,
  CommonResponseMeta,
  CommonStandardErrorCode,
  CommonValidationErrorCode,
  CommonWarning,
  Course,
  CourseCreate,
  CourseInstructor,
  CourseReport,
  CourseReportParticipant,
  CourseInstructorRole,
  CourseInstructorStatus,
  CourseInstructorSummary,
  CourseInstructorUser,
  CourseLevel,
  CourseStatus,
  CourseType,
  CourseUpdate,
  EducationEntry,
  Enrollment,
  EnrollmentStatus,
  EnrollmentType,
  ExperienceEntry,
  FailureReasonCode,
  FundingSource,
  HealthStatus,
  InstitutionCreate,
  InstitutionOwnership,
  InstitutionOwnershipGrant,
  InstitutionProfileUpdate,
  InstitutionRequest,
  InstitutionRequestCreate,
  InstitutionRequestStatus,
  Lesson,
  LessonContentType,
  SlideDeck,
  SlideDeckUpsert,
  Module,
  Notification,
  NotificationType,
  ParticipantGender,
  ParticipantProfile,
  ParticipantProfileUpdate,
  Quiz,
  QuizAttempt,
  QuizAttemptGrade,
  QuizAttemptStatus,
  QuizAttemptSubmit,
  QuizCreate,
  QuizDetail,
  QuizOption,
  QuizQuestion,
  QuizQuestionCreate,
  QuizQuestionType,
  QuizQuestionUpdate,
  QuizUpdate,
  RegisteredInstitution,
  ReportUser,
  RequesterInfo,
  InstitutionReport,
  InstitutionReportCourseRow,
  TrainingType,
  User,
  UserRole,
  UserSuspend,
  UserCapabilities,
  AdminOverview,
  AdminGrowth30d,
  AuditLogEntry,
  PlatformSettings,
  PlatformSettingsUpdate,
  TelemetryEvent,
  TelemetryEventCreate,
  TelemetryDailyPoint,
  TelemetryParticipantRow,
  CourseTelemetrySummary,
} from "../gen/types.gen.js"

/** Global account role — ownership is a join, not a role (see institutions.tsp). */
export type ContractUserRole = UserRole
export type ContractInstitutionRequestStatus = InstitutionRequestStatus
export type ContractRequesterInfo = RequesterInfo
export type ContractInstitutionRequest = InstitutionRequest
export type ContractInstitutionRequestCreate = InstitutionRequestCreate
export type ContractRegisteredInstitution = RegisteredInstitution
export type ContractInstitutionProfileUpdate = InstitutionProfileUpdate
export type ContractInstitutionCreate = InstitutionCreate
export type ContractInstitutionOwnership = InstitutionOwnership
export type ContractInstitutionOwnershipGrant = InstitutionOwnershipGrant

/** The canonical account identity — see users.tsp. */
export type ContractAccountStatus = AccountStatus
export type ContractUser = User
export type ContractUserCapabilities = UserCapabilities
export type ContractUserSuspend = UserSuspend

// --- Assignment domain (spec/assignments.tsp) -----------------------------

// --- Course domain (spec/courses.tsp) ------------------------------------

export type ContractCourseType = CourseType
export type ContractCourseLevel = CourseLevel
export type ContractCourseStatus = CourseStatus
export type ContractTrainingType = TrainingType
export type ContractFundingSource = FundingSource
export type ContractLessonContentType = LessonContentType
export type ContractLesson = Lesson
export type ContractSlideDeck = SlideDeck
export type ContractSlideDeckUpsert = SlideDeckUpsert
export type ContractModule = Module
export type ContractCourseInstructorSummary = CourseInstructorSummary
export type ContractCourse = Course
export type ContractCourseCreate = CourseCreate
export type ContractCourseUpdate = CourseUpdate

// --- Course-instructor domain (spec/course-instructors.tsp) -------------

export type ContractCourseInstructorRole = CourseInstructorRole
export type ContractCourseInstructorStatus = CourseInstructorStatus
export type ContractCourseInstructorUser = CourseInstructorUser
export type ContractCourseInstructor = CourseInstructor

// --- Enrollment domain (spec/enrollments.tsp) ----------------------------

export type ContractEnrollmentStatus = EnrollmentStatus
export type ContractEnrollmentType = EnrollmentType
export type ContractFailureReasonCode = FailureReasonCode
export type ContractEnrollment = Enrollment
export type ContractParticipantGender = ParticipantGender
export type ContractEducationEntry = EducationEntry
export type ContractExperienceEntry = ExperienceEntry
export type ContractCertificationEntry = CertificationEntry
export type ContractParticipantProfile = ParticipantProfile

// --- Certificate-settings domain (spec/certificate-settings.tsp) ---------

export type ContractCertificateSignaturePlacement = CertificateSignaturePlacement
export type ContractCertificateSignature = CertificateSignature
export type ContractCertificateSettings = CertificateSettings
export type ContractCertificateSettingsUpdate = CertificateSettingsUpdate

// --- Certificate domain (spec/certificates.tsp) ---------------------------

export type ContractCertificateUser = CertificateUser
export type ContractCertificateCourse = CertificateCourse
export type ContractCertificateInstitution = CertificateInstitution
export type ContractCertificate = Certificate
export type ContractCertificateIssue = CertificateIssue

// --- Quiz domain (spec/quizzes.tsp) ---------------------------------------

export type ContractQuizQuestionType = QuizQuestionType
export type ContractQuizAttemptStatus = QuizAttemptStatus
export type ContractQuizOption = QuizOption
export type ContractQuiz = Quiz
export type ContractQuizCreate = QuizCreate
export type ContractQuizUpdate = QuizUpdate
export type ContractQuizQuestion = QuizQuestion
export type ContractQuizQuestionCreate = QuizQuestionCreate
export type ContractQuizQuestionUpdate = QuizQuestionUpdate
export type ContractQuizDetail = QuizDetail
export type ContractQuizAttempt = QuizAttempt
export type ContractQuizAttemptSubmit = QuizAttemptSubmit
export type ContractQuizAttemptGrade = QuizAttemptGrade

// --- Health domain (spec/health.tsp) -------------------------------------

export type ContractHealthStatus = HealthStatus

// --- References domain (spec/references.tsp) -----------------------------
// Generic admin-managed lookup/master-data table (one resource, category
// discriminator) — see references.tsp's doc comment for which free-string
// fields elsewhere this is meant to eventually back.

// --- Response envelopes (spec/shared/common.tsp, adapted from the VAMIOS
// --- vamios-core standard) -----------------------------------------------

export type ContractResponseMeta = CommonResponseMeta
export type ContractWarning = CommonWarning
export type ContractPageLinks = CommonPageLinks
export type ContractPagePagination = CommonPagePagination
export type ContractErrorDetail = CommonErrorDetail
export type ContractErrorObject = CommonErrorObject
export type ContractErrorResponse = CommonErrorResponse
export type ContractStandardErrorCode = CommonStandardErrorCode
export type ContractValidationErrorCode = CommonValidationErrorCode

/**
 * Generic envelope pair. OpenAPI can't express generics, so the generator
 * inlines DataResponse<T>/PagedResponse<T> per operation — these authored
 * aliases reassemble them from the generated parts for consumer code.
 */
export interface ContractDataResponse<T> {
  data: T
  meta: ContractResponseMeta
  warnings?: ContractWarning[]
}

export interface ContractPagedResponse<T> {
  data: T[]
  pagination: ContractPagePagination
  meta: ContractResponseMeta
  warnings?: ContractWarning[]
}

// Enums are generated as JS objects (openapi-ts.config.ts's `enums:
// "javascript"` option) as well as types — re-export the value forms for
// consumers that need to reference the concrete members (e.g. apps/api
// route/service code), not just the type.
export { UserRole, InstitutionRequestStatus, AccountStatus } from "../gen/types.gen.js"
export {
  CourseType,
  CourseLevel,
  CourseStatus,
  TrainingType,
  FundingSource,
  LessonContentType,
} from "../gen/types.gen.js"
export { CourseInstructorRole, CourseInstructorStatus } from "../gen/types.gen.js"
export { EnrollmentStatus, EnrollmentType, FailureReasonCode, ParticipantGender } from "../gen/types.gen.js"
export type {
  Notification,
  NotificationType,
  CourseReport,
  CourseReportParticipant,
  InstitutionReport,
  InstitutionReportCourseRow,
  ParticipantProfileUpdate,
  ReportUser,
} from "../gen/types.gen.js"

/** Contract-prefixed aliases for the notifications/reports
 *  domains, matching the consumer-facing naming convention above. */

export type ContractNotification = Notification
export type ContractNotificationType = NotificationType
export type ContractCourseReport = CourseReport
export type ContractCourseReportParticipant = CourseReportParticipant

export type ContractAdminOverview = AdminOverview
export type ContractAdminGrowth30d = AdminGrowth30d

export type ContractInstitutionReport = InstitutionReport
export type ContractInstitutionReportCourseRow = InstitutionReportCourseRow
export type ContractParticipantProfileUpdate = ParticipantProfileUpdate
export type ContractReportUser = ReportUser
export type ContractAuditLogEntry = AuditLogEntry
export type ContractAnnouncement = Announcement
export type ContractAnnouncementCreate = AnnouncementCreate
export type ContractAnnouncementPriority = AnnouncementPriority
export type ContractPlatformSettings = PlatformSettings
export type ContractPlatformSettingsUpdate = PlatformSettingsUpdate
export type ContractTelemetryEvent = TelemetryEvent
export type ContractTelemetryEventCreate = TelemetryEventCreate
export type ContractTelemetryDailyPoint = TelemetryDailyPoint
export type ContractTelemetryParticipantRow = TelemetryParticipantRow
export type ContractCourseTelemetrySummary = CourseTelemetrySummary
export { CertificateSignaturePlacement } from "../gen/types.gen.js"
export { QuizQuestionType, QuizAttemptStatus } from "../gen/types.gen.js"
export { NotificationType as NotificationTypeValue } from "../gen/types.gen.js"
