import { eq } from "drizzle-orm"
import { db } from "../db/index.js"
import { notifications } from "../db/app-schema.js"
import { users as userTable } from "../db/auth-schema.js"
import { env } from "../env.js"
import { sendEmail } from "./email.js"
import { generateId } from "./response.js"

/**
 * Transactional notification: one in-app row + one email. Fire-and-forget
 * by design (same contract as lib/audit.ts) — a failed notification must
 * never fail the business action that triggered it, so errors are logged
 * loudly and swallowed.
 *
 * Call AFTER the action's transaction committed, otherwise a rollback
 * would leave a notification for something that never happened.
 */
export async function notifyUser(entry: {
  userId: string
  type: string
  title: string
  body?: string
  /** App-relative route for the frontend's click-through, e.g. "/learn/crs_x". */
  link?: string
  /** Recipient email — required for the email leg; omit to log in-app only. */
  email?: string
}): Promise<void> {
  try {
    await db.insert(notifications).values({
      id: generateId("ntf"),
      userId: entry.userId,
      type: entry.type,
      title: entry.title,
      body: entry.body,
      link: entry.link,
    })
  } catch (error) {
    console.error("[notify] failed to record", entry.type, entry.userId, error)
  }

  if (!entry.email) return
  try {
    // The stored row keeps the app-relative link; the email needs the
    // absolute one or the href is dead inside a mail client.
    const absoluteLink = entry.link?.startsWith("http") ? entry.link : `${env.WEB_PUBLIC_URL}${entry.link ?? ""}`
    await sendEmail({
      to: entry.email,
      subject: entry.title,
      html: [
        `<p>${entry.title}</p>`,
        entry.body ? `<p>${entry.body}</p>` : "",
        absoluteLink ? `<p><a href="${absoluteLink}">Buka di LMS</a></p>` : "",
      ].join(""),
    })
  } catch (error) {
    console.error("[notify] failed to email", entry.type, entry.userId, error)
  }
}

/** Same, resolving the recipient's email from the account table — the
 *  usual shape at call sites that only hold a userId. A missing account
 *  logs the in-app row and skips the email leg. */
export async function notifyUserById(
  userId: string,
  entry: Omit<Parameters<typeof notifyUser>[0], "userId" | "email">
): Promise<void> {
  let email: string | undefined
  try {
    const [account] = await db
      .select({ email: userTable.email })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1)
    email = account?.email
  } catch (error) {
    console.error("[notify] failed to look up recipient", userId, error)
  }
  await notifyUser({ ...entry, userId, email })
}
