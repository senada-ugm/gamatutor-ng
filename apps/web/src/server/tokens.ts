import { createHash, randomBytes } from 'node:crypto';

/** A URL-safe secret for a cookie or an emailed link. */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/** What the database stores in place of the token. */
export function tokenId(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Short, unambiguous certificate serial: no 0/O or 1/I. */
export function newSerial(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(10);
  let s = '';
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `DRV-${s.slice(0, 5)}-${s.slice(5)}`;
}
