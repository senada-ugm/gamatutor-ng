'use server';

import { revalidatePath } from 'next/cache';
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
  newResetToken,
  requestPasswordReset,
  resetPassword,
  verificationRequired,
} from '@/server/accounts';
import { enrol } from '@/server/catalogue';
import { setIdentityVerified } from '@/server/people';
import { getMailer } from '@/server/mailer';
import { allow, blocked, fail } from '@/server/ratelimit';
import { fieldErrors, parseRegistration, profileSchema } from '@/server/registration';
import {
  baseUrl,
  clearSessionCookie,
  clientIp,
  requireAdmin,
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
  // Generous per address: a hospital or workshop registers from one NAT IP.
  if (!allow(`register:${await clientIp()}`, 120, 3_600_000)) {
    return { message: 'Terlalu banyak percobaan pendaftaran. Coba lagi dalam satu jam.', values: kept(v) };
  }
  const parsed = parseRegistration(v);
  if (!parsed.ok) return { errors: parsed.errors, values: kept(v) };
  try {
    const db = await getDb();
    const { user, verifyToken } = await registerUser(db, parsed.data);
    if (!verificationRequired()) {
      // Signed in straight away, but the email stays unverified, so turning
      // verification on later still asks these accounts to confirm.
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
  // Only failures count, so a whole class signing in from one address is fine.
  if (blocked(`login-ip:${ip}`, 200) || blocked(`login:${email}`, 10)) {
    return { message: 'Terlalu banyak percobaan masuk yang gagal. Tunggu 15 menit lalu coba lagi.', values: { email } };
  }
  const db = await getDb();
  let token: string;
  try {
    ({ token } = await login(db, email, v.password ?? ''));
  } catch (e) {
    if (!(e instanceof AccountError)) throw e;
    if (e.code === 'bad-login') {
      fail(`login-ip:${ip}`, 900_000);
      fail(`login:${email}`, 900_000);
    }
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

/** Always the same answer, so the form does not reveal which emails exist. */
export async function forgotAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const generic: FormState = {
    done: true,
    message: getMailer().logsOnly
      ? 'Pengiriman email belum aktif di server ini. Hubungi admin pelatihan; admin dapat membuatkan tautan atur ulang kata sandi untuk Anda.'
      : 'Jika email itu terdaftar, kami sudah mengirim tautan untuk mengatur ulang kata sandi. Periksa juga folder spam.',
  };
  if (!email || !allow(`forgot:${await clientIp()}`, 30, 3_600_000) || !allow(`forgot:${email}`, 3, 3_600_000)) {
    return generic;
  }
  const db = await getDb();
  const found = await requestPasswordReset(db, email);
  if (found && !getMailer().logsOnly) {
    const link = `${await baseUrl()}/atur-sandi?token=${encodeURIComponent(found.token)}`;
    await getMailer().send({
      to: found.user.email,
      subject: 'Atur ulang kata sandi — DRIVE School',
      text: `Halo ${found.user.fullName},

Klik tautan berikut untuk membuat kata sandi baru:
${link}

Tautan berlaku 2 jam. Abaikan email ini jika Anda tidak memintanya.`,
    });
  }
  return generic;
}

export async function resetAction(_prev: FormState, form: FormData): Promise<FormState> {
  const token = String(form.get('token') ?? '');
  const password = String(form.get('password') ?? '');
  if (password.length < 8) return { errors: { password: 'Kata sandi minimal 8 karakter.' } };
  if (password !== form.get('passwordConfirm')) {
    return { errors: { passwordConfirm: 'Konfirmasi kata sandi tidak sama.' } };
  }
  try {
    await resetPassword(await getDb(), token, password);
  } catch (e) {
    if (e instanceof AccountError) return { message: e.message };
    throw e;
  }
  redirect('/masuk?reset=1');
}

/** An admin hands a learner a reset link in person when email is not set up. */
export async function adminResetAction(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const userId = String(form.get('userId') ?? '');
  const db = await getDb();
  const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, userId) });
  if (!user) return { message: 'Peserta tidak ditemukan.' };
  const token = await newResetToken(db, user.id);
  return { done: true, devLink: `${await baseUrl()}/atur-sandi?token=${encodeURIComponent(token)}` };
}

/** An admin marks a learner's identity as checked against the organiser's list. */
export async function adminIdentityAction(form: FormData): Promise<void> {
  await requireAdmin();
  const userId = String(form.get('userId') ?? '');
  await setIdentityVerified(await getDb(), userId, form.get('verified') === '1');
  revalidatePath('/admin/peserta');
}
