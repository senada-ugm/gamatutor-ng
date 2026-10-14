CREATE TABLE "slide_decks" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"manifest" jsonb NOT NULL,
	"post_test_quiz_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "slide_decks_course_id_unique" UNIQUE("course_id")
);
--> statement-breakpoint
ALTER TABLE "slide_decks" ADD CONSTRAINT "slide_decks_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "slide_decks_course_idx" ON "slide_decks" USING btree ("course_id");