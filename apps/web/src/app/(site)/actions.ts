'use server';

import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import {
  AccountError,
  createSession,
  login,
  logout,
  newVerifyToken,
  registerUser,
  updateProfile,
  verificationRequired,
  verifyEmail,
} from '@/server/accounts';
import { enrol } from '@/server/catalogue';
import { getMailer } from '@/server/mailer';
import { allow } from '@/server/ratelimit';
import { fieldErrors, parseRegistration, profileSchema } from '@/server/registration';
import {
  baseUrl,
  clearSessionCookie,
  clientIp,
  requireUser,
  safeNext,
  sessionToken,
  setSessionCookie,
} from '@/server/session';

export interface FormState {
  errors?: Record<string, string>;
  message?: string;
  values?: Record<string, string>;
  /** Shown only when mail goes to the server log (development, or no SMTP yet). */
  devLink?: string;
  done?: boolean;
}

const KEEP = ['fullName', 'birthDate', 'profession', 'institution', 'province', 'city', 'phone', 'email'];

function values(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') out[k] = v;
  return out;
}

function kept(v: Record<string, string>): Record<string, string> {
  return Object.fromEntries(KEEP.filter((k) => k in v).map((k) => [k, v[k]!]));
}

async function sendVerification(email: string, name: string, token: string): Promise<string | undefined> {
  const link = `${await baseUrl()}/verifikasi?token=${encodeURIComponent(token)}`;
  const mailer = getMailer();
  await mailer.send({
    to: email,
    subject: 'Verifikasi email Anda — DRIVE School',
    text: `Halo ${name},\n\nKlik tautan berikut untuk mengaktifkan akun pelatihan Anda:\n${link}\n\nTautan berlaku 48 jam. Abaikan email ini jika Anda tidak mendaftar.`,
  });
  // Showing the link on the page would make verification pointless, so only
  // in development, where mail goes to the console anyway.
  return mailer.logsOnly && process.env.NODE_ENV !== 'production' ? link : undefined;
}

export async function registerAction(_prev: FormState, form: FormData): Promise<FormState> {
  const v = values(form);
  if (!allow(`register:${await clientIp()}`, 10, 3_600_000)) {
    return { message: 'Terlalu banyak percobaan pendaftaran. Coba lagi dalam satu jam.', values: kept(v) };
  }
  const parsed = parseRegistration(v);
  if (!parsed.ok) return { errors: parsed.errors, values: kept(v) };
  try {
    const db = await getDb();
    const { user, verifyToken } = await registerUser(db, parsed.data);
    if (!verificationRequired()) {
      await verifyEmail(db, verifyToken);
      await setSessionCookie(await createSession(db, user.id));
      redirect('/kursus');
    }
    const devLink = await sendVerification(user.email, user.fullName, verifyToken);
    return { done: true, message: user.email, ...(devLink ? { devLink } : {}) };
  } catch (e) {
    if (e instanceof AccountError) return { errors: { email: e.message }, values: kept(v) };
    throw e;
  }
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const v = values(form);
  const email = (v.email ?? '').trim().toLowerCase();
  const ip = await clientIp();
  if (!allow(`login-ip:${ip}`, 30, 900_000) || !allow(`login:${email}`, 8, 900_000)) {
    return { message: 'Terlalu banyak percobaan masuk. Tunggu 15 menit lalu coba lagi.', values: { email } };
  }
  const db = await getDb();
  let token: string;
  try {
    ({ token } = await login(db, email, v.password ?? ''));
  } catch (e) {
    if (!(e instanceof AccountError)) throw e;
    if (e.code === 'unverified') {
      const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.email, email) });
      let devLink: string | undefined;
      if (user && allow(`reverify:${email}`, 3, 3_600_000)) {
        devLink = await sendVerification(user.email, user.fullName, await newVerifyToken(db, user.id));
      }
      return {
        message: `${e.message} Kami sudah mengirim ulang tautannya.`,
        values: { email },
        ...(devLink ? { devLink } : {}),
      };
    }
    return { message: e.message, values: { email } };
  }
  await setSessionCookie(token);
  redirect(safeNext(v.lanjut));
}

export async function logoutAction(): Promise<void> {
  await logout(await getDb(), await sessionToken());
  await clearSessionCookie();
  redirect('/');
}

export async function profileAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser('/profil');
  const v = values(form);
  const r = profileSchema().safeParse(v);
  if (!r.success) return { errors: fieldErrors(r.error), values: kept(v) };
  await updateProfile(await getDb(), user.id, r.data);
  return { done: true, message: 'Profil tersimpan.', values: kept(v) };
}

export async function startCourseAction(form: FormData): Promise<void> {
  const slug = String(form.get('slug') ?? '');
  const user = await requireUser(`/kursus/${slug}`);
  const enrolment = await enrol(await getDb(), user.id, slug);
  if (!enrolment) redirect('/kursus');
  redirect(`/belajar/${slug}`);
}
