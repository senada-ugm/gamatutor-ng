CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"issuer" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"created_by_id" text NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"user_id" text NOT NULL,
	"content" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"score" integer,
	"feedback" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"graded_at" timestamp,
	"is_late" boolean DEFAULT false NOT NULL,
	CONSTRAINT "assignment_submissions_status_check" CHECK ("assignment_submissions"."status" in ('draft', 'submitted', 'graded', 'returned'))
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"lesson_id" text,
	"title" text NOT NULL,
	"description" text,
	"instructions" text,
	"max_score" integer DEFAULT 100 NOT NULL,
	"due_date" timestamp,
	"allow_late_submission" boolean DEFAULT false NOT NULL,
	"late_submission_penalty" integer DEFAULT 0 NOT NULL,
	"allowed_file_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"max_file_size" integer,
	"max_files" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text NOT NULL,
	"checked_in_at" timestamp,
	"checked_in_method" text,
	"checked_in_latitude" real,
	"checked_in_longitude" real,
	"excuse_reason" text,
	CONSTRAINT "attendance_records_status_check" CHECK ("attendance_records"."status" in ('present', 'late', 'absent', 'excused'))
);
--> statement-breakpoint
CREATE TABLE "attendance_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"title" text NOT NULL,
	"session_date" timestamp NOT NULL,
	"start_time" text,
	"end_time" text,
	"session_status" text DEFAULT 'pending' NOT NULL,
	"verification_method" text DEFAULT 'none' NOT NULL,
	"verification_code" text,
	"code_generated_at" timestamp,
	"code_expiry_seconds" integer,
	"qr_token" text,
	"qr_token_expires_at" timestamp,
	"latitude" real,
	"longitude" real,
	"radius_meters" integer DEFAULT 100 NOT NULL,
	"late_threshold_minutes" integer DEFAULT 15 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_sessions_status_check" CHECK ("attendance_sessions"."session_status" in ('pending', 'active', 'completed', 'cancelled', 'holiday')),
	CONSTRAINT "attendance_sessions_verification_check" CHECK ("attendance_sessions"."verification_method" in ('none', 'code', 'qr'))
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificate_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"signatures" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"custom_field_labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "certificate_settings_course_id_unique" UNIQUE("course_id")
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" text PRIMARY KEY NOT NULL,
	"enrollment_id" text NOT NULL,
	"course_id" text NOT NULL,
	"user_id" text NOT NULL,
	"certificate_number" text NOT NULL,
	"verification_code" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "certificates_enrollment_id_unique" UNIQUE("enrollment_id"),
	CONSTRAINT "certificates_certificate_number_unique" UNIQUE("certificate_number"),
	CONSTRAINT "certificates_verification_code_unique" UNIQUE("verification_code")
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"discount_type" text NOT NULL,
	"discount_value" integer NOT NULL,
	"max_discount_amount" integer,
	"course_id" text,
	"institution_id" text,
	"max_uses" integer,
	"max_uses_per_user" integer DEFAULT 1 NOT NULL,
	"current_uses" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp,
	"expires_at" timestamp,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code"),
	CONSTRAINT "coupons_discount_type_check" CHECK ("coupons"."discount_type" in ('percentage', 'fixed'))
);
--> statement-breakpoint
CREATE TABLE "course_instructors" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"email" text NOT NULL,
	"user_id" text,
	"role" text DEFAULT 'instructor' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_lessons" (
	"id" text PRIMARY KEY NOT NULL,
	"module_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"is_preview" boolean DEFAULT false NOT NULL,
	"content_type" text,
	"text_content" text,
	"url" text,
	"duration" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_modules" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"short_description" text,
	"description" text,
	"thumbnail" text,
	"course_type" text NOT NULL,
	"location" text,
	"scheduled_at" timestamp,
	"scheduled_end_at" timestamp,
	"registration_open_at" timestamp,
	"registration_close_at" timestamp,
	"registrant_quota" integer,
	"participant_quota" integer,
	"registrant_count" integer DEFAULT 0 NOT NULL,
	"participant_count" integer DEFAULT 0 NOT NULL,
	"level" text NOT NULL,
	"language" text NOT NULL,
	"training_type" text,
	"custom_training_type" text,
	"is_disability_friendly" boolean DEFAULT false NOT NULL,
	"supported_disability_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"minimum_education" text,
	"minimum_age" integer,
	"maximum_age" integer,
	"city_code" text,
	"funding_source" text,
	"custom_funding_source" text,
	"training_budget" integer,
	"contact_person_name" text,
	"contact_person_phone" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"institution_id" text NOT NULL,
	"instructor" jsonb NOT NULL,
	"modules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"price" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "courses_slug_unique" UNIQUE("slug"),
	CONSTRAINT "courses_status_check" CHECK ("courses"."status" in ('draft', 'published'))
);
--> statement-breakpoint
CREATE TABLE "discussion_replies" (
	"id" text PRIMARY KEY NOT NULL,
	"discussion_id" text NOT NULL,
	"parent_reply_id" text,
	"content" text NOT NULL,
	"user_id" text NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discussions" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"lesson_id" text,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"user_id" text NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"status" text DEFAULT 'registered' NOT NULL,
	"enrollment_type" text DEFAULT 'free' NOT NULL,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp,
	"interviewed_at" timestamp,
	"interview_notes" text,
	"failed_at" timestamp,
	"failure_reason" text,
	"failure_notes" text,
	"completed_at" timestamp,
	"final_grade" integer,
	"certificate_issued" boolean DEFAULT false NOT NULL,
	"certificate_id" text,
	CONSTRAINT "enrollments_status_check" CHECK ("enrollments"."status" in ('registered', 'interviewed', 'selected', 'failed', 'graduated', 'canceled'))
);
--> statement-breakpoint
CREATE TABLE "institution_ownerships" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"institution_id" text NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institution_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"institution_name" text NOT NULL,
	"institution_type" text NOT NULL,
	"description" text,
	"website" text,
	"email" text,
	"phone" text,
	"address" text,
	"justification" text,
	"requested_by_user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institutions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"institution_type" text NOT NULL,
	"description" text,
	"website" text,
	"email" text,
	"phone" text,
	"address" text,
	"status" text DEFAULT 'approved' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"lesson_id" text NOT NULL,
	"course_id" text NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"coupon_id" text,
	"coupon_code" text,
	"original_price" integer NOT NULL,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"final_amount" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_method" text DEFAULT 'manual_transfer' NOT NULL,
	"confirmed_by_user_id" text,
	"external_session_id" text,
	"external_payment_intent_id" text,
	"paid_at" timestamp,
	"refunded_at" timestamp,
	"refund_reason" text,
	"canceled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_status_check" CHECK ("orders"."status" in ('pending', 'paid', 'canceled', 'refunded'))
);
--> statement-breakpoint
CREATE TABLE "participant_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"phone" text,
	"about" text,
	"education_level" text,
	"address" text,
	"residential_address" text,
	"dati2" text,
	"gender" text,
	"nationality" text,
	"religion" text,
	"marital_status" text,
	"birth_date" date,
	"ktp_number" text,
	"bpjs_kesehatan_number" text,
	"education" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"experience" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"certifications" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"platform_name" text DEFAULT 'Solo Kerja' NOT NULL,
	"support_email" text NOT NULL,
	"support_phone" text,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"allow_institution_requests" boolean DEFAULT true NOT NULL,
	"certificate_validity_months" integer DEFAULT 24 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"quiz_id" text NOT NULL,
	"user_id" text NOT NULL,
	"attempt_number" integer NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"score" integer,
	"max_score" integer,
	"passed" boolean,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"submitted_at" timestamp,
	"graded_at" timestamp,
	"category_scores" jsonb,
	"report_meta" jsonb,
	CONSTRAINT "quiz_attempts_status_check" CHECK ("quiz_attempts"."status" in ('in_progress', 'submitted', 'pending_review', 'graded', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"quiz_id" text NOT NULL,
	"question" text NOT NULL,
	"question_type" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"correct_answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"points" integer DEFAULT 10 NOT NULL,
	"explanation" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"category" text,
	"option_weights" jsonb
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text,
	"lesson_id" text,
	"title" text NOT NULL,
	"description" text,
	"passing_score" integer DEFAULT 70 NOT NULL,
	"max_attempts" integer DEFAULT 1 NOT NULL,
	"time_limit" integer,
	"shuffle_questions" boolean DEFAULT false NOT NULL,
	"shuffle_options" boolean DEFAULT false NOT NULL,
	"show_results" boolean DEFAULT true NOT NULL,
	"show_correct_answers" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "references" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"label_en" text,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"purpose" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"status" text DEFAULT 'unclaimed' NOT NULL,
	"uploaded_by_user_id" text NOT NULL,
	"owner_type" text,
	"owner_id" text,
	"claimed_at" timestamp,
	"released_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wishlist_items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_lesson_id_course_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."course_lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_session_id_attendance_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."attendance_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate_settings" ADD CONSTRAINT "certificate_settings_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_instructors" ADD CONSTRAINT "course_instructors_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_module_id_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_replies" ADD CONSTRAINT "discussion_replies_discussion_id_discussions_id_fk" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_lesson_id_course_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."course_lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institution_ownerships" ADD CONSTRAINT "institution_ownerships_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_course_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."course_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_lesson_id_course_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."course_lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_issuer_accountId_uidx" ON "accounts" USING btree ("issuer","account_id");--> statement-breakpoint
CREATE INDEX "accounts_userId_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_userId_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "announcements_course_idx" ON "announcements" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assignment_submissions_assignment_user_idx" ON "assignment_submissions" USING btree ("assignment_id","user_id");--> statement-breakpoint
CREATE INDEX "assignment_submissions_user_idx" ON "assignment_submissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "assignments_course_idx" ON "assignments" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_records_session_user_idx" ON "attendance_records" USING btree ("session_id","user_id");--> statement-breakpoint
CREATE INDEX "attendance_sessions_course_idx" ON "attendance_sessions" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "certificates_course_idx" ON "certificates" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "certificates_user_idx" ON "certificates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "coupons_institution_idx" ON "coupons" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "coupons_course_idx" ON "coupons" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "course_instructors_course_email_idx" ON "course_instructors" USING btree ("course_id","email");--> statement-breakpoint
CREATE INDEX "course_instructors_user_idx" ON "course_instructors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "course_lessons_module_idx" ON "course_lessons" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "course_modules_course_idx" ON "course_modules" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "courses_institution_idx" ON "courses" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "discussion_replies_discussion_idx" ON "discussion_replies" USING btree ("discussion_id");--> statement-breakpoint
CREATE INDEX "discussions_course_idx" ON "discussions" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_user_course_idx" ON "enrollments" USING btree ("user_id","course_id");--> statement-breakpoint
CREATE INDEX "enrollments_course_idx" ON "enrollments" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "institution_ownerships_user_institution_idx" ON "institution_ownerships" USING btree ("user_id","institution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_progress_user_lesson_idx" ON "lesson_progress" USING btree ("user_id","lesson_id");--> statement-breakpoint
CREATE INDEX "lesson_progress_course_idx" ON "lesson_progress" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_user_course_active_idx" ON "orders" USING btree ("user_id","course_id") WHERE status in ('pending', 'paid');--> statement-breakpoint
CREATE INDEX "orders_course_idx" ON "orders" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "orders_coupon_idx" ON "orders" USING btree ("coupon_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_attempts_quiz_user_attempt_idx" ON "quiz_attempts" USING btree ("quiz_id","user_id","attempt_number");--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_idx" ON "quiz_attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "quizzes_course_idx" ON "quizzes" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "references_category_code_idx" ON "references" USING btree ("category","code");--> statement-breakpoint
CREATE UNIQUE INDEX "wishlist_user_course_idx" ON "wishlist_items" USING btree ("user_id","course_id");--> statement-breakpoint
CREATE INDEX "wishlist_user_idx" ON "wishlist_items" USING btree ("user_id");