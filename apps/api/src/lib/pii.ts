import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto"
import { env } from "../env.js"

/**
 * Field-level encryption for high-sensitivity PII (KTP/NIK, BPJS numbers)
 * stored in participant_profiles. AES-256-GCM, key derived from the
 * PII_ENCRYPTION_KEY secret via scrypt.
 *
 * With no key configured (local dev), values are stored as-is — the
 * prefixed format makes ciphertext self-describing, so turning the key on
 * later keeps existing plaintext rows readable and new writes encrypted.
 * The real protection lands when a profile-update write path exists; the
 * read path below is already decrypt-aware so that transition is silent.
 */

const PREFIX = "enc:v1:"

let derivedKey: Buffer | null | undefined

function getKey(): Buffer | null {
  if (derivedKey === undefined) {
    derivedKey = env.PII_ENCRYPTION_KEY ? scryptSync(env.PII_ENCRYPTION_KEY, "lms-pii-v1", 32) : null
  }
  return derivedKey
}

/** Encrypts a value for storage. No key configured → returned unchanged
 *  (documented dev fallback, not a silent failure in production: env docs
 *  say to set the key wherever real PII is collected). */
export function encryptPii(plain: string): string {
  const key = getKey()
  if (!key) return plain
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`
}

/** Decrypts a stored value. Non-prefixed values (never encrypted, or a
 *  deployment that turned the key on late) pass through untouched; a
 *  value that fails authentication (wrong key, tampering) yields
 *  undefined rather than throwing — a corrupted field must not 500 the
 *  whole profile read. */
export function decryptPii(stored: string | null | undefined): string | undefined {
  if (stored == null) return undefined
  if (!stored.startsWith(PREFIX)) return stored
  const key = getKey()
  if (!key) return undefined
  try {
    const [ivPart, tagPart, dataPart] = stored.slice(PREFIX.length).split(":")
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart!, "base64url"))
    decipher.setAuthTag(Buffer.from(tagPart!, "base64url"))
    return Buffer.concat([decipher.update(Buffer.from(dataPart!, "base64url")), decipher.final()]).toString("utf8")
  } catch {
    return undefined
  }
}

/**
 * Display form of an identity number for anyone who is not its owner.
 * A course manager needs to know the participant supplied a KTP/BPJS
 * number, not what it is — reading the digits is a compliance export,
 * not a roster lookup. Keeps the last 4 so a support conversation can
 * still confirm "the one ending 7890".
 */
export function maskPii(value: string | undefined): string | undefined {
  if (!value) return value
  const tail = value.slice(-4)
  return `${"•".repeat(Math.max(value.length - tail.length, 0))}${tail}`
}
