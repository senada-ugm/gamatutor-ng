ALTER TABLE "attempts" ADD COLUMN "resume_seq" bigint;--> statement-breakpoint
ALTER TABLE "results" ADD COLUMN "client_attempt" integer;