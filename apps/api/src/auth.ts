import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin } from "better-auth/plugins"
import { db } from "./db/index.js"
import { env, corsOrigins } from "./env.js"
import { generateId } from "./lib/response.js"
import { sendEmail } from "./lib/email.js"

const MODEL_ID_PREFIXES: Record<string, string> = {
  user: "usr",
  session: "ses",
  account: "acc",
  verification: "ver",
}

export const auth = betterAuth({
  appName: "LMS",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  basePath: "/api/auth",
  // Better Auth ships its OWN in-memory rate limiter, separate from the
  // Fastify @fastify/rate-limit gate below. Left on, it silently swallows
  // verification emails after a few signups per boot (the endpoint still
  // returns {status:true}!) — which stalls the registration journey smoke
  // with EMAIL_NOT_VERIFIED. Gate it on the same env flag.
  rateLimit: { enabled: env.RATE_LIMIT_ENABLED },
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),
  advanced: {
    database: {
      generateId: ({ model }) => generateId(MODEL_ID_PREFIXES[model] ?? model.slice(0, 5)),
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    // Without this callback Better Auth's forget-password endpoint can't
    // deliver its token — users who forget their password would be stuck
    // with no self-service recovery path (and no admin reset exists).
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your password — LMS",
        html: `<p>Hi ${user.name || user.email},</p><p>We received a request to reset your LMS password. If this was you, follow the link below (it can only be used once):</p><p><a href="${url}">${url}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
      })
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your email — LMS",
        html: `<p>Hi ${user.name || user.email},</p><p>Confirm your email address to finish setting up your LMS account:</p><p><a href="${url}">${url}</a></p>`,
      })
    },
  },
  socialProviders: {
    ...(env.GOOGLE_CLIENT_ID
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            redirectURI: `${env.BETTER_AUTH_URL}/api/auth/callback/google`,
          },
        }
      : {}),
  },
  plugins: [
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
    }),
  ],
  trustedOrigins: corsOrigins,
})
