import { desc, eq, ilike, or } from 'drizzle-orm';
import type { Db } from '../db/client';
import { users } from '../db/schema';

/** Accounts for the admin list, newest first, optionally filtered by name or email. */
export async function listPeople(db: Db, q = '', limit = 300) {
  const term = q.trim();
  const where = term
    ? or(ilike(users.fullName, `%${term}%`), ilike(users.email, `%${term}%`), ilike(users.institution, `%${term}%`))
    : undefined;
  return db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      profession: users.profession,
      institution: users.institution,
      city: users.city,
      province: users.province,
      phone: users.phone,
      createdAt: users.createdAt,
      emailVerifiedAt: users.emailVerifiedAt,
      identityVerifiedAt: users.identityVerifiedAt,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(limit);
}

/** An admin confirms (or withdraws) that this account is the person it claims to be. */
export async function setIdentityVerified(db: Db, userId: string, verified: boolean): Promise<void> {
  await db
    .update(users)
    .set({ identityVerifiedAt: verified ? new Date() : null })
    .where(eq(users.id, userId));
}
