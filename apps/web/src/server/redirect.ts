const ORIGIN = 'https://gamatutor.invalid';

/**
 * Only a path on this site is followed after login. Parsing it the way the
 * browser will (URL drops tabs and newlines, and treats `\` as `/`) and
 * comparing origins catches `//evil`, `/\evil` and `/%09/evil` alike.
 */
export function safeNext(next: unknown, fallback = '/kursus'): string {
  if (typeof next !== 'string' || !next.startsWith('/')) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  try {
    const url = new URL(next, ORIGIN);
    if (url.origin !== ORIGIN) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
