import { db } from "../db/index.js"
import { notifications } from "../db/app-schema.js"
import { generateId } from "./response.js"

/**
 * In-app notification row. Fire-and-forget by design — a failed
 * notification must never fail the business action that triggered it, so
 * errors are logged loudly and swallowed.
 *
 * The transactional-email leg was removed with the PKS minimum-scope
 * trims (PLANS 6.2): the platform's notification surface is the in-app
 * bell, and email stays exclusively Better Auth's (verification and
 * password reset). Call AFTER the action's transaction committed,
 * otherwise a rollback would leave a notification for something that
 * never happened.
 */
export async function notifyUserById(
  userId: string,
  entry: {
    type: string
    title: string
    body?: string
    /** App-relative route for the frontend's click-through, e.g. "/learn/crs_x". */
    link?: string
  }
): Promise<void> {
  try {
    await db.insert(notifications).values({
      id: generateId("ntf"),
      userId,
      type: entry.type,
      title: entry.title,
      body: entry.body,
      link: entry.link,
    })
  } catch (error) {
    console.error("[notify] failed to record", entry.type, userId, error)
  }
}
