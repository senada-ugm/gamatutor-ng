import { apiSend } from "@/lib/api"

const PENDING_PROFILE_KEY = "pending_doctor_profile"

/**
 * Registration collects clinical fields Better Auth's sign-up body can't
 * carry (email verification gates any authenticated call until the email
 * link is followed), so register.tsx stages them in localStorage and the
 * app syncs them into `participant_profiles` once a session exists.
 *
 * This module owns that handoff as a guaranteed retry rather than a
 * fire-once: the key survives any sync failure and every sync point
 * (explicit login AND dashboard mount — the verification link
 * auto-signs-in without ever passing through the login page) retries
 * until a PATCH lands, so the data can no longer be silently dropped.
 */

export function hasPendingDoctorProfile(): boolean {
  try {
    return localStorage.getItem(PENDING_PROFILE_KEY) !== null
  } catch {
    // Blocked site data — nothing was persisted to sync.
    return false
  }
}

function readPending(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(PENDING_PROFILE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return typeof parsed === "object" && parsed !== null ? parsed : null
  } catch {
    return null
  }
}

/** Attempts the pending-profile PATCH. Returns true when the profile was
 *  synced (and the staged copy removed); false leaves the key in place so
 *  the next sync point retries. Cheap no-op when nothing is staged. */
export async function syncPendingDoctorProfile(userId: string): Promise<boolean> {
  const pending = readPending()
  if (!pending) return false
  try {
    await apiSend("PATCH", `/participant-profiles/${userId}`, pending)
  } catch {
    return false
  }
  try {
    localStorage.removeItem(PENDING_PROFILE_KEY)
  } catch {
    // Removal failing means the next sync PATCHs the same data again —
    // idempotent upsert, so harmless.
  }
  return true
}
