CREATE TABLE "learning_telemetry_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"module_id" text,
	"slide_id" text NOT NULL,
	"session_id" text,
	"entered_at" timestamp NOT NULL,
	"exited_at" timestamp,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"audio_listened_seconds" integer DEFAULT 0 NOT NULL,
	"interacted_elements" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "participant_profiles" ADD COLUMN "profession" text;--> statement-breakpoint
ALTER TABLE "participant_profiles" ADD COLUMN "institution_name" text;--> statement-breakpoint
ALTER TABLE "participant_profiles" ADD COLUMN "str_number" text;--> statement-breakpoint
CREATE INDEX "learning_telemetry_user_idx" ON "learning_telemetry_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "learning_telemetry_course_idx" ON "learning_telemetry_logs" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "learning_telemetry_slide_idx" ON "learning_telemetry_logs" USING btree ("slide_id");--> statement-breakpoint
CREATE INDEX "learning_telemetry_created_at_idx" ON "learning_telemetry_logs" USING btree ("created_at");