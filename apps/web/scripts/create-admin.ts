/**
 * Creates (or promotes) an admin account, already verified.
 *
 *   GT_ADMIN_PASSWORD=… pnpm web admin:create admin@example.id "Nama Admin"
 *
 * The password comes from the environment so it never lands in shell history.
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../src/db/client';
import { users } from '../src/db/schema';
import { registerUser, verifyEmail } from '../src/server/accounts';
import { hashPassword } from '../src/server/password';

const [email, name = 'Admin GamaTutor'] = process.argv.slice(2);
const password = process.env.GT_ADMIN_PASSWORD;
if (!email || !password || password.length < 12) {
  console.error('usage: GT_ADMIN_PASSWORD=<12+ chars> admin:create <email> ["Full Name"]');
  process.exit(2);
}

const db = await getDb();
const normalised = email.trim().toLowerCase();
const existing = await db.query.users.findFirst({ where: eq(users.email, normalised) });
if (existing) {
  await db
    .update(users)
    .set({ role: 'admin', passwordHash: await hashPassword(password), emailVerifiedAt: existing.emailVerifiedAt ?? new Date() })
    .where(eq(users.id, existing.id));
  console.log(`promoted ${normalised} to admin and reset the password`);
} else {
  const { verifyToken } = await registerUser(
    db,
    {
      email: normalised,
      password,
      passwordConfirm: password,
      consent: 'on',
      fullName: name,
      birthDate: '1980-01-01',
      profession: 'Tenaga kesehatan lain',
      institution: 'Tim DRIVE',
      province: 'DI Yogyakarta',
      city: 'Yogyakarta',
      phone: '080000000000',
    },
    'admin',
  );
  await verifyEmail(db, verifyToken);
  console.log(`created admin ${normalised}`);
}
process.exit(0);
