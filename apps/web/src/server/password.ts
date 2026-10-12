import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((ok, fail) =>
    scrypt(password.normalize('NFKC'), salt, KEYLEN, { N, r: R, p: P }, (err, key) =>
      err ? fail(err) : ok(key),
    ),
  );
}

/** `scrypt$N$r$p$salt$hash`, base64 parts; parameters travel with the hash. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, saltB64, hashB64] = stored.split('$');
  if (alg !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const key = await new Promise<Buffer>((ok, fail) =>
    scrypt(
      password.normalize('NFKC'),
      Buffer.from(saltB64, 'base64'),
      expected.length,
      { N: Number(n), r: Number(r), p: Number(p) },
      (err, k) => (err ? fail(err) : ok(k)),
    ),
  );
  return key.length === expected.length && timingSafeEqual(key, expected);
}
