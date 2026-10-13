'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { FormState } from '@/app/(site)/actions';

type Action = (prev: FormState, form: FormData) => Promise<FormState>;

interface FieldProps {
  name: string;
  label: string;
  state: FormState;
  type?: string;
  hint?: string;
  autoComplete?: string;
  options?: readonly string[];
  defaultValue?: string;
  required?: boolean;
}

function Field({ name, label, state, type = 'text', hint, autoComplete, options, defaultValue, required = true }: FieldProps) {
  const error = state.errors?.[name];
  const value = state.values?.[name] ?? defaultValue ?? '';
  const id = `f-${name}`;
  const describedBy = [error ? `${id}-err` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {options ? (
        <select id={id} name={name} defaultValue={value} required={required} aria-invalid={!!error} aria-describedby={describedBy}>
          <option value="" disabled>
            — Pilih —
          </option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          defaultValue={type === 'password' ? undefined : value}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy}
        />
      )}
      {hint && (
        <div className="hint" id={`${id}-hint`}>
          {hint}
        </div>
      )}
      {error && (
        <div className="error" id={`${id}-err`} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

/**
 * React resets a form after its action runs; remounting with the returned
 * values keeps what the learner typed when the server sends errors back.
 */
const formKey = (state: FormState) => JSON.stringify(state.values ?? {}) + JSON.stringify(state.errors ?? {});

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? 'Memproses…' : children}
    </button>
  );
}

function DevLink({ link }: { link?: string }) {
  if (!link) return null;
  return (
    <p className="notice info small devlink">
      Mode pengembangan (email belum dikirim): <a href={link}>buka tautan verifikasi</a>
    </p>
  );
}

interface ProfileFieldsProps {
  state: FormState;
  professions: readonly string[];
  provinces: readonly string[];
  defaults?: Record<string, string>;
}

function ProfileFields({ state, professions, provinces, defaults = {} }: ProfileFieldsProps) {
  const d = (k: string) => defaults[k];
  return (
    <>
      <Field name="fullName" label="Nama lengkap (beserta gelar)" state={state} autoComplete="name" defaultValue={d('fullName')}
        hint="Nama ini dicetak pada sertifikat. Tulis persis seperti yang Anda inginkan." />
      <div className="grid2">
        <Field name="birthDate" label="Tanggal lahir" type="date" state={state} autoComplete="bday" defaultValue={d('birthDate')} />
        <Field name="phone" label="Nomor telepon/WhatsApp" type="tel" state={state} autoComplete="tel" defaultValue={d('phone')} hint="Contoh: 0812xxxxxxx" />
      </div>
      <div className="grid2">
        <Field name="profession" label="Profesi" state={state} options={professions} defaultValue={d('profession')} />
        <Field name="institution" label="Instansi / fasilitas kesehatan" state={state} autoComplete="organization" defaultValue={d('institution')}
          hint="Contoh: Puskesmas Depok I, RSUD Sleman" />
      </div>
      <div className="grid2">
        <Field name="province" label="Provinsi" state={state} options={provinces} defaultValue={d('province')} />
        <Field name="city" label="Kabupaten/kota" state={state} autoComplete="address-level2" defaultValue={d('city')} />
      </div>
    </>
  );
}

export function RegisterForm({ action, professions, provinces }: { action: Action; professions: readonly string[]; provinces: readonly string[] }) {
  const [state, formAction] = useActionState(action, {});
  if (state.done) {
    return (
      <div className="form">
        <p className="notice ok">
          Pendaftaran berhasil. Kami mengirim tautan verifikasi ke <b>{state.message}</b>. Buka tautan itu untuk mengaktifkan akun,
          lalu masuk.
        </p>
        <DevLink link={state.devLink} />
        <Link className="btn btn-ghost" href="/masuk">
          Ke halaman masuk
        </Link>
      </div>
    );
  }
  return (
    <form key={formKey(state)} action={formAction} className="form" noValidate>
      {state.message && <p className="notice err">{state.message}</p>}
      <fieldset className="form">
        <legend>Data diri</legend>
        <ProfileFields state={state} professions={professions} provinces={provinces} />
      </fieldset>
      <fieldset className="form">
        <legend>Akun</legend>
        <Field name="email" label="Email" type="email" state={state} autoComplete="email" />
        <div className="grid2">
          <Field name="password" label="Kata sandi" type="password" state={state} autoComplete="new-password" hint="Minimal 8 karakter." />
          <Field name="passwordConfirm" label="Ulangi kata sandi" type="password" state={state} autoComplete="new-password" />
        </div>
      </fieldset>
      <div className={`field${state.errors?.consent ? ' has-error' : ''}`}>
        <label className="check">
          <input type="checkbox" name="consent" required />
          <span>
            Saya setuju data di atas digunakan untuk penyelenggaraan pelatihan, sertifikat, dan evaluasi program oleh tim DRIVE.
          </span>
        </label>
        {state.errors?.consent && <div className="error" role="alert">{state.errors.consent}</div>}
      </div>
      <Submit>Daftar</Submit>
      <p className="small muted">
        Sudah punya akun? <Link href="/masuk">Masuk</Link>
      </p>
    </form>
  );
}

export function LoginForm({ action, next }: { action: Action; next: string }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form key={formKey(state)} action={formAction} className="form" noValidate>
      {state.message && <p className="notice err" role="alert">{state.message}</p>}
      <DevLink link={state.devLink} />
      <input type="hidden" name="lanjut" value={next} />
      <Field name="email" label="Email" type="email" state={state} autoComplete="email" />
      <Field name="password" label="Kata sandi" type="password" state={state} autoComplete="current-password" />
      <Submit>Masuk</Submit>
      <p className="small muted">
        Belum punya akun? <Link href="/daftar">Daftar sebagai peserta</Link>
      </p>
    </form>
  );
}

export function ProfileForm({
  action,
  professions,
  provinces,
  defaults,
}: {
  action: Action;
  professions: readonly string[];
  provinces: readonly string[];
  defaults: Record<string, string>;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form key={formKey(state)} action={formAction} className="form" noValidate>
      {state.done && <p className="notice ok" role="status">{state.message}</p>}
      <ProfileFields state={state} professions={professions} provinces={provinces} defaults={defaults} />
      <Submit>Simpan profil</Submit>
    </form>
  );
}
