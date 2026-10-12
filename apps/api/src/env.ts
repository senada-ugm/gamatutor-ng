import path from "node:path"
import { fileURLToPath } from "node:url"
import { config } from "dotenv"
import { z } from "zod"

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

config({ path: path.join(appDirectory, ".env.local"), quiet: true })
config({ path: path.join(appDirectory, ".env"), quiet: true })

const booleanFromEnvironment = (defaultValue: boolean) =>
  z.preprocess((value) => {
    if (value === "" || value === undefined) {
      return defaultValue
    }
    if (value === "true") {
      return true
    }
    if (value === "false") {
      return false
    }
    return value
  }, z.boolean())

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(8000),
    // The web app origin — must be a valid origin, empty disables CORS origin checks.
    CORS_ORIGIN: z.string().default("http://localhost:3030"),
    // Rate limiting defaults ON: auth endpoints without it are
    // brute-forceable. Local dev/test opt out via .env.local.
    RATE_LIMIT_ENABLED: booleanFromEnvironment(true),
    // Trust X-Forwarded-* from the reverse proxy — required for correct
    // rate-limit keys behind a load balancer; keep off for direct exposure
    // (clients could spoof the header to rotate their limit key).
    TRUST_PROXY: booleanFromEnvironment(false),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

    // Attendance sessions store wall-clock "HH:MM" times in this timezone —
    // present/late math must NOT depend on the server process's own TZ
    // (containers default to UTC; the business runs in Indonesia).
    BUSINESS_TIMEZONE: z.string().default("Asia/Jakarta"),

    // How long a manually-typed attendance verification code stays valid
    // after activation (the QR token is a fixed short 20s — scanning is
    // instant). See attendance.service.ts's checkIn.
    ATTENDANCE_CODE_EXPIRY_SECONDS: z.coerce.number().int().min(10).max(3600).default(300),

    // Shared rate-limit store for multi-instance deployments. Unset =
    // in-memory (per-instance budgets — fine for one node, wrong behind a
    // load balancer). See plugins/rate-limit.ts.
    REDIS_URL: z.string().optional().default(""),

    // Passphrase for field-level PII encryption (KTP/BPJS numbers in
    // participant_profiles — see src/lib/pii.ts). Optional: unset means
    // plaintext storage (local dev). Set it in any environment where real
    // identity numbers are collected; rotating it orphans existing
    // ciphertext (reads return undefined for those fields, never an error).
    PII_ENCRYPTION_KEY: z.string().optional().default(""),

    // Auth (Better Auth) — a dedicated Postgres database for apps/api, kept
    // separate from the parent solokerja app's DB.
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
    BETTER_AUTH_URL: z.string().default("http://localhost:8000"),

    // Database connection pool limit — size appropriately per pod against PgBouncer / Postgres max_connections.
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

    // Email — SMTP (Mailpit on 1025 for local dev) or Resend API (production).
    SMTP_HOST: z.string().optional().default(""),
    SMTP_PORT: z.coerce.number().int().default(1025),
    SMTP_USER: z.string().optional().default(""),
    SMTP_PASS: z.string().optional().default(""),
    SMTP_SECURE: booleanFromEnvironment(false),
    RESEND_API_KEY: z.string().optional().default(""),
    RESEND_FROM_EMAIL: z.string().default("LMS <onboarding@resend.dev>"),

    // Object Storage (S3-compatible: RustFS, MinIO, Cloudflare R2, AWS S3).
    // When S3_BUCKET is unset, uploads fall back to local disk storage.
    S3_ENDPOINT: z.string().optional().default(""),
    S3_BUCKET: z.string().optional().default(""),
    S3_REGION: z.string().default("us-east-1"),
    S3_ACCESS_KEY_ID: z.string().optional().default(""),
    S3_SECRET_ACCESS_KEY: z.string().optional().default(""),
    S3_FORCE_PATH_STYLE: booleanFromEnvironment(true),

    // Google social login — optional: unset means the provider is wired but
    // inert until real credentials are supplied.
    GOOGLE_CLIENT_ID: z.string().optional().default(""),
    GOOGLE_CLIENT_SECRET: z.string().optional().default(""),

    // Stripe-compatible payment gateway — unset PAYMENT_SECRET_KEY disables
    // it entirely (paid courses then run on manual-transfer confirmation).
    // See lib/stripe.ts; PAYMENT_API_BASE exists so Stripe-compatible
    // processors (or stripe-mock in tests) can be pointed at.
    PAYMENT_SECRET_KEY: z.string().optional().default(""),
    PAYMENT_WEBHOOK_SECRET: z.string().optional().default(""),
    PAYMENT_API_BASE: z.string().default("https://api.stripe.com"),
    // ISO 4217 lowercase. Zero-decimal currencies (idr) send unit_amount
    // as-is; two-decimal currencies would need *100 before creating the
    // checkout session.
    PAYMENT_CURRENCY: z.string().default("idr"),
    PAYMENT_SUCCESS_URL: z.string().optional().default(""),
    PAYMENT_CANCEL_URL: z.string().optional().default(""),

    // Uploads — local disk storage (see src/lib/storage.ts) with an orphan
    // sweep. TTL is env-overridable so the sweep is testable without
    // waiting the real default out. API_PUBLIC_URL is kept separate from
    // BETTER_AUTH_URL so upload URLs don't silently break if auth config
    // is ever repointed independently.
    UPLOAD_ORPHAN_TTL_HOURS: z.coerce.number().default(24),
    // Multi-instance deployments should point every instance at a shared
    // volume (or swap storage.ts for an object-store adapter).
    UPLOAD_STORAGE_DIR: z.string().optional().default(""),
    API_PUBLIC_URL: z.string().default("http://localhost:8000"),

    // Web app origin — notification emails link back into the app, and an
    // in-app-relative "/learn/..." href is dead inside a mail client.
    WEB_PUBLIC_URL: z.string().default("http://localhost:3000"),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production") {
      if (!data.PII_ENCRYPTION_KEY || data.PII_ENCRYPTION_KEY.length < 16) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["PII_ENCRYPTION_KEY"],
          message: "PII_ENCRYPTION_KEY must be at least 16 characters in production",
        })
      }
      if (!data.RESEND_API_KEY && !data.SMTP_HOST) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["RESEND_API_KEY"],
          message: "Either RESEND_API_KEY or SMTP_HOST must be configured in production to deliver auth emails",
        })
      }
    }
  })

function validateEnv() {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    console.error("Invalid environment variables:")
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`)
    }
    process.exit(1)
  }

  return parsed.data
}

export const env = validateEnv()

export const corsOrigins: string[] = env.CORS_ORIGIN.split(",")
  .map((s) => s.trim())
  .filter(Boolean)
