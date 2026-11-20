CREATE TABLE "course_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer NOT NULL,
	"review" text,
	"suggestion" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "course_reviews_rating_check" CHECK ("course_reviews"."rating" >= 1 and "course_reviews"."rating" <= 5)
);
--> statement-breakpoint
ALTER TABLE "course_reviews" ADD CONSTRAINT "course_reviews_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "course_reviews_course_user_idx" ON "course_reviews" USING btree ("course_id","user_id");--> statement-breakpoint
CREATE INDEX "course_reviews_course_idx" ON "course_reviews" USING btree ("course_id");