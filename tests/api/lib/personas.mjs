/**
 * Persona bootstrap: signs the seeded accounts in through the real
 * Better Auth endpoint and hands back one cookie-jar client per persona
 * (plus each account's id for ownership/scope assertions). The anonymous
 * persona is a jarless client — every gated request it makes must come
 * back 401, which is exactly what the scenarios assert.
 */
import { createClient } from "./http.mjs"

const PASSWORD = process.env.LMS_TEST_PASSWORD ?? "correcthorsebatterystaple"

export async function bootstrap({ base, coverage }) {
  async function signIn(email) {
    const client = createClient({
      base,
      coverage,
      label: email,
      origin: process.env.WEB_ORIGIN ?? "http://localhost:3030",
    })
    const res = await client.post("/api/auth/sign-in/email", {
      json: { email, password: PASSWORD },
    })
    if (res.status !== 200) {
      throw new Error(`sign-in failed for ${email} (${res.status}) — is the DB seeded? (pnpm --filter api db:seed)`)
    }
    return { client, userId: res.body?.user?.id }
  }

  const admin = await signIn("admin@lms.dev")
  const owner = await signIn("owner@lms.dev")
  const user = await signIn("user@lms.dev")

  return {
    anon: createClient({ base, coverage, label: "anonymous" }),
    admin: admin.client,
    owner: owner.client,
    user: user.client,
    ids: { adminId: admin.userId, ownerId: owner.userId, userId: user.userId },
  }
}
