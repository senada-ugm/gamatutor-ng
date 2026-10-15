ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_status_check";--> statement-breakpoint
ALTER TABLE "enrollments" DROP COLUMN "interviewed_at";--> statement-breakpoint
ALTER TABLE "enrollments" DROP COLUMN "interview_notes";--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_status_check" CHECK ("enrollments"."status" in ('registered', 'selected', 'failed', 'graduated', 'canceled'));