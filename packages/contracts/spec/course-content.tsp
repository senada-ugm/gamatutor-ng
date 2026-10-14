import "@typespec/http";
import "@typespec/rest";

import "./shared/common.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using Lms.Common;

/**
 * Course content domain: the module/lesson tree a course is built from,
 * plus per-user lesson completion. Previously `courses.modules` was a
 * JSONB blob with no way to track progress; this gives modules/lessons
 * their own CRUD surface (Course.modules on courses.tsp's Course model
 * still returns the composed tree for backward-compat reads) and adds
 * LessonProgress so CoursePlayer can persist "mark complete" instead of
 * simulating it in local component state.
 */
namespace Lms {
  enum LessonContentType {
    text: "text";
    video: "video";
    audio: "audio";
    document: "document";
  }

  model Lesson {
    @key
    id: ResourceId;
    title: string;
    description?: string;
    isPreview?: boolean;
    contentType?: LessonContentType;
    textContent?: string;
    url?: string;
    /** Minutes — only meaningful for video/audio lessons. */
    duration?: int32;
  }

  model Module {
    @key
    id: ResourceId;
    title: string;
    description?: string;
    lessons: Lesson[];
  }

  model LessonCreate {
    title: string;
    description?: string;
    isPreview?: boolean;
    contentType?: LessonContentType;
    textContent?: string;
    url?: string;
    duration?: int32;
  }

  model LessonUpdate {
    ...LessonCreate;
  }

  model ModuleCreate {
    title: string;
    description?: string;
  }

  model ModuleUpdate {
    ...ModuleCreate;
  }

  /** An interactive slide deck attached to a course (the DRIVE-style
   *  narrated player). The manifest is deliberately opaque to the
   *  contract: its shape (modules/pages/audio cues/hotspots) is owned by
   *  apps/app's `lib/content/course-types.ts` and evolves with the
   *  player, not with the API — the server stores and serves it, plus a
   *  schemaVersion so consumers can refuse manifests they can't render.
   *  `postTestQuizId` links the deck's evaluation section to a real quiz
   *  so attempts are graded and recorded server-side. */
  model SlideDeck {
    courseId: ResourceId;
    schemaVersion: int32;
    manifest: Record<unknown>;
    @visibility(Lifecycle.Read)
    postTestQuizId?: ResourceId;
    @visibility(Lifecycle.Read)
    updatedAt: utcDateTime;
  }

  model SlideDeckUpsert {
    schemaVersion: int32;
    manifest: Record<unknown>;
  }

  @route("/courses/{courseId}/slide-deck")
  @tag("Course Content")
  interface CourseSlideDecksApi {
    /** The course's interactive slide deck, if one is attached. Course
     *  managers and active participants; 404 when the course teaches
     *  through plain lessons instead. */
    @get
    get(@path courseId: ResourceId): DataResponse<SlideDeck> | ErrorResponse;

    /** Attaches or replaces the course's interactive slide deck. Course
     *  management only — the manifest is authored content. */
    @put
    upsert(
      @path courseId: ResourceId,
      @body body: SlideDeckUpsert
    ): DataResponse<SlideDeck> | ErrorResponse;
  }

  /** A student's completion mark on one lesson. */
  model LessonProgress {
    @key
    id: ResourceId;
    userId: ResourceId;
    lessonId: ResourceId;
    courseId: ResourceId;
    @visibility(Lifecycle.Read)
    completedAt: utcDateTime;
  }

  @route("/courses/{courseId}/modules")
  @tag("Course Content")
  interface CourseModulesApi {
    /** Appends a new module to the course's content tree. Course-management only. */
    @post
    create(@path courseId: ResourceId, @body body: ModuleCreate): {
      @statusCode statusCode: 201;
      @body body: DataResponse<Module>;
    } | ErrorResponse;
  }

  @route("/modules/{moduleId}")
  @tag("Course Content")
  interface ModulesApi {
    /** Updates a module's title/description. Course-management only. */
    @patch
    update(@path moduleId: ResourceId, @body body: ModuleUpdate): DataResponse<Module> | ErrorResponse;

    /** Deletes a module and its lessons. Course-management only. */
    @delete
    delete(@path moduleId: ResourceId): {
      @statusCode statusCode: 204;
    } | ErrorResponse;
  }

  @route("/modules/{moduleId}/lessons")
  @tag("Course Content")
  interface ModuleLessonsApi {
    /** Appends a new lesson to a module. Course-management only. */
    @post
    create(@path moduleId: ResourceId, @body body: LessonCreate): {
      @statusCode statusCode: 201;
      @body body: DataResponse<Lesson>;
    } | ErrorResponse;
  }

  @route("/lessons/{lessonId}")
  @tag("Course Content")
  interface LessonsApi {
    /** Updates a lesson's content fields. Course-management only. */
    @patch
    update(@path lessonId: ResourceId, @body body: LessonUpdate): DataResponse<Lesson> | ErrorResponse;

    /** Deletes a lesson. Course-management only. */
    @delete
    delete(@path lessonId: ResourceId): {
      @statusCode statusCode: 204;
    } | ErrorResponse;
  }

  @route("/lesson-progress")
  @tag("Course Content")
  interface LessonProgressApi {
    /** A user's completed-lesson ids for one course — CoursePlayer seeds
     *  its "completed" set from this on mount. */
    @get
    @list
    list(...PageParams, @query courseId: ResourceId, @query userId: ResourceId): PagedResponse<LessonProgress> | ErrorResponse;

    /** Marks a lesson complete for the caller (idempotent). Requires an active enrollment; managers bypass. */
    @post
    @route("{lessonId}/complete")
    complete(@path lessonId: ResourceId, @query courseId: ResourceId): DataResponse<LessonProgress> | ErrorResponse;

    /** Removes the caller's completion mark from a lesson. */
    @delete
    @route("{lessonId}/complete")
    uncomplete(@path lessonId: ResourceId): {
      @statusCode statusCode: 204;
    } | ErrorResponse;
  }
}
