import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getDb } from '../db/client';
import type { User } from '../db/schema';
import { SESSION_DAYS, userForSession } from './accounts';

export const SESSION_COOKIE = 'gt_session';

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** The signed-in user for this request (looked up once per request). */
export const currentUser = cache(async (): Promise<User | null> => {
  return userForSession(await getDb(), await sessionToken());
});

export async function requireUser(next = '/kursus'): Promise<User> {
  const user = await currentUser();
  if (!user) redirect(`/masuk?lanjut=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser('/admin');
  if (user.role !== 'admin') redirect('/kursus');
  return user;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'local';
}

export async function baseUrl(): Promise<string> {
  if (process.env.GT_BASE_URL) return process.env.GT_BASE_URL.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3100';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export { safeNext } from './redirect';
