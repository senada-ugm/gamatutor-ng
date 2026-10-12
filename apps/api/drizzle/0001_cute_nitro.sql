ALTER TABLE "references" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "references" CASCADE;--> statement-breakpoint
DROP INDEX "accounts_issuer_accountId_uidx";--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "issuer" DROP NOT NULL;