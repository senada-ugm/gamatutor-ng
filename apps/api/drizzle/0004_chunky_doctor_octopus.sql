DROP INDEX "enrollments_user_course_idx";--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_user_course_idx" ON "enrollments" USING btree ("user_id","course_id") WHERE "enrollments"."deleted_at" is null;