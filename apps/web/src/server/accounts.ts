import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Db } from '../db/client';
import { emailTokens, sessions, users, type User } from '../db/schema';
import { hashPassword, verifyPassword } from './password';
import type { Profile, Registration } from './registration';
import { newToken, tokenId } from './tokens';

export const SESSION_DAYS = 30;
const DAY = 86_400_000;
const VERIFY_HOURS = 48;

export class AccountError extends Error {
  constructor(
    readonly code: 'email-taken' | 'bad-login' | 'unverified' | 'bad-token',
    message: string,
  ) {
    super(message);
  }
}

export async function registerUser(
  db: Db,
  input: Registration,
  role: 'learner' | 'admin' = 'learner',
): Promise<{ user: User; verifyToken: string }> {
  const existing = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  if (existing) throw new AccountError('email-taken', 'Email ini sudah terdaftar. Silakan masuk.');
  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role,
      fullName: input.fullName,
      birthDate: input.birthDate,
      profession: input.profession,
      institution: input.institution,
      province: input.province,
      city: input.city,
      phone: input.phone,
    })
    .returning();
  return { user: user!, verifyToken: await newVerifyToken(db, user!.id) };
}

export async function newVerifyToken(db: Db, userId: string): Promise<string> {
  const token = newToken();
  await db.insert(emailTokens).values({
    id: tokenId(token),
    userId,
    purpose: 'verify',
    expiresAt: new Date(Date.now() + VERIFY_HOURS * 3_600_000),
  });
  return token;
}

/** Marks the email verified; a token works once and expires after 48 hours. */
export async function verifyEmail(db: Db, token: string): Promise<User> {
  const row = await db.query.emailTokens.findFirst({
    where: and(
      eq(emailTokens.id, tokenId(token)),
      eq(emailTokens.purpose, 'verify'),
      isNull(emailTokens.usedAt),
      gt(emailTokens.expiresAt, new Date()),
    ),
  });
  if (!row) throw new AccountError('bad-token', 'Tautan verifikasi tidak valid atau sudah kedaluwarsa.');
  await db.update(emailTokens).set({ usedAt: new Date() }).where(eq(emailTokens.id, row.id));
  const [user] = await db
    .update(users)
    .set({ emailVerifiedAt: new Date() })
    .where(eq(users.id, row.userId))
    .returning();
  return user!;
}

/** Returns a new session token for the cookie. */
export async function login(db: Db, email: string, password: string): Promise<{ token: string; user: User }> {
  const user = await db.query.users.findFirst({ where: eq(users.email, email.trim().toLowerCase()) });
  // Hash even for unknown emails, so timing does not reveal which exist.
  const ok = await verifyPassword(password, user?.passwordHash ?? 'scrypt$16384$8$1$AAAA$AAAA');
  if (!user || !ok) throw new AccountError('bad-login', 'Email atau kata sandi salah.');
  if (!user.emailVerifiedAt) {
    throw new AccountError('unverified', 'Email Anda belum diverifikasi. Buka tautan yang kami kirim ke email Anda.');
  }
  return { token: await createSession(db, user.id), user };
}

export async function createSession(db: Db, userId: string): Promise<string> {
  const token = newToken();
  await db.insert(sessions).values({
    id: tokenId(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_DAYS * DAY),
  });
  return token;
}

/** The signed-in user, extending the session when it is past half its life. */
export async function userForSession(db: Db, token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const id = tokenId(token);
  const row = await db.query.sessions.findFirst({ where: eq(sessions.id, id) });
  if (!row || row.expiresAt.getTime() <= Date.now()) return null;
  if (row.expiresAt.getTime() - Date.now() < (SESSION_DAYS * DAY) / 2) {
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_DAYS * DAY) })
      .where(eq(sessions.id, id));
  }
  return (await db.query.users.findFirst({ where: eq(users.id, row.userId) })) ?? null;
}

export async function logout(db: Db, token: string | undefined): Promise<void> {
  if (token) await db.delete(sessions).where(eq(sessions.id, tokenId(token)));
}

export async function updateProfile(db: Db, userId: string, profile: Profile): Promise<User> {
  const [user] = await db.update(users).set(profile).where(eq(users.id, userId)).returning();
  return user!;
}
