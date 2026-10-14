import "@typespec/http";
import "@typespec/rest";

import "./shared/common.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using Lms.Common;

/**
 * Quiz domain: instructor-authored quizzes with auto-gradable question
 * types (single/multiple choice, true/false, short answer, Likert) plus
 * essay questions that need manual grading. `QuizQuestion.correctAnswers`
 * is populated only for callers who manage the course - one model, not
 * a separate authoring type, so a
 * student attempting the quiz never receives answers over the wire
 * regardless of what the UI does with them.
 *
 * `Quiz.courseId` is optional: a quiz with no course is a standalone
 * assessment (career/psychometric test, served at /assessments instead
 * of /courses/{courseId}/quizzes). `courseId` presence is the only
 * discriminator - there is deliberately no separate "kind" field.
 * Assessment-only questions use `category` (e.g. RIASEC "R"/"I"/.../"C",
 * or "grammar"/"vocabulary") to group per-category scoring, and
 * `questionType: likert` scores by summing `optionWeights` per category
 * instead of comparing against `correctAnswers`. The resulting
 * `QuizAttempt.categoryScores`/`reportMeta` are opaque to the quiz engine
 * - just persisted and handed back for the UI to render.
 */
namespace Lms {
  enum QuizQuestionType {
    singleChoice: "single_choice";
    multipleChoice: "multiple_choice";
    trueFalse: "true_false";
    shortAnswer: "short_answer";
    essay: "essay";
    likert: "likert";
  }

  enum QuizAttemptStatus {
    inProgress: "in_progress";
    submitted: "submitted";
    pendingReview: "pending_review";
    graded: "graded";
    /** A timed attempt that was never submitted and whose window closed -
     *  auto-set when the learner next starts an attempt (or the instructor
     *  resets it). Still counts against maxAttempts, so abandoning a
     *  started attempt can't be used to peek at questions for free. */
    expired: "expired";
  }

  model QuizOption {
    text: string;
  }

  model Quiz {
    @key
    id: ResourceId;
    courseId?: ResourceId;
    lessonId?: ResourceId;
    title: string;
    description?: string;
    passingScore: int32;
    maxAttempts: int32;
    /** Time limit in minutes; 0/null = no limit. Enforced server-side at submit. */    timeLimit?: int32;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showResults: boolean;
    showCorrectAnswers: boolean;
    @visibility(Lifecycle.Read)
    questionCount: int32;
    @visibility(Lifecycle.Read)
    createdAt: utcDateTime;
  }

  model QuizCreate {
    lessonId?: ResourceId;
    title: string;
    description?: string;
    passingScore?: int32;
    maxAttempts?: int32;
    /** Time limit in minutes; 0/null = no limit. Enforced server-side at submit. */    timeLimit?: int32;
    shuffleQuestions?: boolean;
    shuffleOptions?: boolean;
    showResults?: boolean;
    showCorrectAnswers?: boolean;
  }

  model QuizUpdate {
    title?: string;
    description?: string;
    passingScore?: int32;
    maxAttempts?: int32;
    /** Time limit in minutes; 0/null = no limit. Enforced server-side at submit. */    timeLimit?: int32;
    shuffleQuestions?: boolean;
    shuffleOptions?: boolean;
    showResults?: boolean;
    showCorrectAnswers?: boolean;
  }

  model QuizQuestion {
    @key
    id: ResourceId;
    quizId: ResourceId;
    question: string;
    questionType: QuizQuestionType;
    options: QuizOption[];
    /** Server omits this for a caller who doesn't manage the quiz's
     *  course - a student taking the quiz never sees it. */
    @visibility(Lifecycle.Read)
    correctAnswers?: string[];
    points: int32;
    explanation?: string;
    displayOrder: int32;
    /** Assessment-only: groups this question for per-category scoring. */
    category?: string;
    /** Assessment-only: per-option Likert weight, parallel to `options`.
     *  Same visibility gate as correctAnswers - never sent to a student
     *  taking the assessment. */
    @visibility(Lifecycle.Read)
    optionWeights?: int32[];
  }

  model QuizQuestionCreate {
    question: string;
    questionType: QuizQuestionType;
    options?: QuizOption[];
    correctAnswers?: string[];
    points?: int32;
    explanation?: string;
    displayOrder?: int32;
    category?: string;
    optionWeights?: int32[];
  }

  model QuizQuestionUpdate {
    question?: string;
    questionType?: QuizQuestionType;
    options?: QuizOption[];
    correctAnswers?: string[];
    points?: int32;
    explanation?: string;
    displayOrder?: int32;
    category?: string;
    optionWeights?: int32[];
  }

  model QuizDetail extends Quiz {
    questions: QuizQuestion[];
  }

  /** Denormalized display copy of the attempt owner — the grading
   *  queue needs names next to answers. */
  model QuizAttemptUser {
    id: ResourceId;
    name: string;
    email: string;
  }

  model QuizAttempt {
    @key
    id: ResourceId;
    quizId: ResourceId;
    userId: ResourceId;
    user: QuizAttemptUser;
    attemptNumber: int32;
    answers: Record<string[]>;
    score?: int32;
    maxScore?: int32;
    passed?: boolean;
    status: QuizAttemptStatus;
    @visibility(Lifecycle.Read)
    startedAt: utcDateTime;
    @visibility(Lifecycle.Read)
    submittedAt?: utcDateTime;
    @visibility(Lifecycle.Read)
    gradedAt?: utcDateTime;
    /** Assessment-only: per-category aggregate scores. */
    @visibility(Lifecycle.Read)
    categoryScores?: Record<int32>;
    /** Assessment-only: opaque report data (e.g. RIASEC topTypes, CEFR
     *  level) - computed once, just persisted and returned. */
    @visibility(Lifecycle.Read)
    reportMeta?: Record<unknown>;
  }

  model QuizAttemptSubmit {
    answers: Record<string[]>;
  }

  /** Instructor grading pass for a `pending_review` attempt - per-question
   *  point overrides for its essay questions, keyed by questionId. */
  model QuizAttemptGrade {
    scores: Record<int32>;
  }

  @route("/courses/{courseId}/quizzes")
  @tag("Quizzes")
  interface CourseQuizzesApi {
    /** Lists a course's quizzes with per-quiz question counts. */
    @get
    @list
    list(@path courseId: ResourceId, ...PageParams): PagedResponse<Quiz> | ErrorResponse;

    /** Creates a quiz inside a course. Course-management only. */
    @post
    create(@path courseId: ResourceId, @body body: QuizCreate): {
      @statusCode statusCode: 201;
      @body body: DataResponse<Quiz>;
    } | ErrorResponse;
  }

  /** Standalone (course-less) quizzes - career/psychometric assessments.
   *  Same underlying quiz engine as CourseQuizzesApi, just without a
   *  courseId path segment; authoring/attempting an assessment is gated
   *  by assertCanManageAssessment/assertCanAttemptAssessment instead of
   *  course-management/enrollment. */
  @route("/assessments")
  @tag("Quizzes")
  interface AssessmentsApi {
    /** Lists platform-wide assessments — course-less quizzes such as RIASEC. */
    @get
    @list
    list(...PageParams): PagedResponse<Quiz> | ErrorResponse;

    /** Creates a platform-wide assessment. Admin-only. */
    @post
    create(@body body: QuizCreate): {
      @statusCode statusCode: 201;
      @body body: DataResponse<Quiz>;
    } | ErrorResponse;
  }

  @route("/quizzes/{id}")
  @tag("Quizzes")
  interface QuizzesApi {
    /** Fetches one quiz including its questions (correct answers included only for managers). */
    @get
    get(@path id: ResourceId): DataResponse<QuizDetail> | ErrorResponse;

    /** Updates a quiz's settings (passing score, attempts, shuffle, result visibility). Course-management only. */
    @patch
    update(@path id: ResourceId, @body body: QuizUpdate): DataResponse<Quiz> | ErrorResponse;

    /** Deletes a quiz with its questions and attempts. Course-management only. */
    @delete
    delete(@path id: ResourceId): {
      @statusCode statusCode: 204;
    } | ErrorResponse;
  }

  @route("/quizzes/{quizId}/questions")
  @tag("Quizzes")
  interface QuizQuestionsApi {
    /** Adds a question to a quiz. Course-management only. */
    @post
    create(@path quizId: ResourceId, @body body: QuizQuestionCreate): {
      @statusCode statusCode: 201;
      @body body: DataResponse<QuizQuestion>;
    } | ErrorResponse;
  }

  @route("/quiz-questions/{id}")
  @tag("Quizzes")
  interface QuizQuestionApi {
    /** Updates a question's fields. Course-management only. */
    @patch
    update(@path id: ResourceId, @body body: QuizQuestionUpdate): DataResponse<QuizQuestion> | ErrorResponse;

    /** Deletes a question. Course-management only. */
    @delete
    delete(@path id: ResourceId): {
      @statusCode statusCode: 204;
    } | ErrorResponse;
  }

  @route("/quizzes/{quizId}/attempts")
  @tag("Quizzes")
  interface QuizAttemptsApi {
    /** The caller's own attempts at this quiz - lets QuizTake compute
     *  attempts-remaining without course-management rights. Course
     *  managers may pass scope=all to list EVERY participant's attempts
     *  (the essay grading queue); anyone else passing it gets 403. */
    @get
    @list
    list(
      @path quizId: ResourceId,
      @query scope?: "all",
      ...PageParams
    ): PagedResponse<QuizAttempt> | ErrorResponse;

    /** Starts a new attempt for the caller, enforcing the quiz's max-attempts limit. */
    @post
    start(@path quizId: ResourceId): {
      @statusCode statusCode: 201;
      @body body: DataResponse<QuizAttempt>;
    } | ErrorResponse;
  }

  @route("/quiz-attempts/{id}")
  @tag("Quizzes")
  interface QuizAttemptApi {
    /** Fetches one attempt by id, including its answers and score. */
    @get
    get(@path id: ResourceId): DataResponse<QuizAttempt> | ErrorResponse;

    /** Grades auto-gradable questions server-side; any essay question
     *  present leaves the attempt `pending_review` until `grade`. */
    @post
    @route("submit")
    submit(@path id: ResourceId, @body body: QuizAttemptSubmit): DataResponse<QuizAttempt> | ErrorResponse;

    /** Course-management only - finalizes a `pending_review` attempt's
     *  essay scores. */
    @post
    @route("grade")
    grade(@path id: ResourceId, @body body: QuizAttemptGrade): DataResponse<QuizAttempt> | ErrorResponse;

    /** Course-management only - deletes an attempt outright (an abandoned
     *  `in_progress`/`expired` attempt that burned the learner's only try,
     *  or a bad-faith result). Frees the attempt number for a retake. */
    @delete
    reset(@path id: ResourceId): void | ErrorResponse;
  }
}
