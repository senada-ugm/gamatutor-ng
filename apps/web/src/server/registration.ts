import { z } from 'zod';

export const PROFESSIONS = [
  'Dokter umum',
  'Dokter spesialis',
  'Dokter residen / PPDS',
  'Dokter internsip',
  'Perawat',
  'Bidan',
  'Refraksionis optisien',
  'Mahasiswa kedokteran / koas',
  'Tenaga kesehatan lain',
] as const;

/** The 38 provinces of Indonesia. */
export const PROVINCES = [
  'Aceh',
  'Sumatera Utara',
  'Sumatera Barat',
  'Riau',
  'Kepulauan Riau',
  'Jambi',
  'Bengkulu',
  'Sumatera Selatan',
  'Kepulauan Bangka Belitung',
  'Lampung',
  'Banten',
  'DKI Jakarta',
  'Jawa Barat',
  'Jawa Tengah',
  'DI Yogyakarta',
  'Jawa Timur',
  'Bali',
  'Nusa Tenggara Barat',
  'Nusa Tenggara Timur',
  'Kalimantan Barat',
  'Kalimantan Tengah',
  'Kalimantan Selatan',
  'Kalimantan Timur',
  'Kalimantan Utara',
  'Sulawesi Utara',
  'Gorontalo',
  'Sulawesi Tengah',
  'Sulawesi Barat',
  'Sulawesi Selatan',
  'Sulawesi Tenggara',
  'Maluku',
  'Maluku Utara',
  'Papua',
  'Papua Barat',
  'Papua Barat Daya',
  'Papua Tengah',
  'Papua Pegunungan',
  'Papua Selatan',
] as const;

const MIN_AGE = 17;

function ageOn(birth: Date, today: Date): number {
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const m = today.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

const text = (label: string, max = 120) =>
  z
    .string({ required_error: `${label} wajib diisi.` })
    .trim()
    .min(2, `${label} wajib diisi.`)
    .max(max, `${label} terlalu panjang.`);

/** Shared by registration and the profile page. */
export function profileSchema(today = new Date()) {
  return z.object({
    fullName: text('Nama lengkap')
      .regex(/^[\p{L}\p{M} .,'’-]+$/u, 'Nama lengkap hanya boleh berisi huruf dan tanda baca nama.')
      .transform((s) => s.replace(/\s+/g, ' ')),
    birthDate: z
      .string({ required_error: 'Tanggal lahir wajib diisi.' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal lahir tidak valid.')
      .refine((s) => !Number.isNaN(Date.parse(s)), 'Tanggal lahir tidak valid.')
      .refine((s) => new Date(s) < today, 'Tanggal lahir harus di masa lalu.')
      .refine((s) => ageOn(new Date(s), today) >= MIN_AGE, `Usia minimal ${MIN_AGE} tahun.`)
      .refine((s) => ageOn(new Date(s), today) <= 100, 'Tanggal lahir tidak valid.'),
    profession: z.enum(PROFESSIONS, { errorMap: () => ({ message: 'Pilih profesi.' }) }),
    institution: text('Instansi', 160),
    province: z.enum(PROVINCES, { errorMap: () => ({ message: 'Pilih provinsi.' }) }),
    city: text('Kabupaten/kota', 80),
    phone: z
      .string({ required_error: 'Nomor telepon wajib diisi.' })
      .trim()
      .transform((s) => s.replace(/[\s.-]/g, ''))
      .transform((s) => (s.startsWith('+62') ? '0' + s.slice(3) : s.startsWith('62') ? '0' + s.slice(2) : s))
      .refine((s) => /^08\d{7,12}$/.test(s), 'Nomor telepon tidak valid (contoh: 0812xxxxxxx).'),
  });
}

export function registrationSchema(today = new Date()) {
  return profileSchema(today)
    .extend({
      email: z
        .string({ required_error: 'Email wajib diisi.' })
        .trim()
        .toLowerCase()
        .email('Email tidak valid.')
        .max(200),
      password: z
        .string({ required_error: 'Kata sandi wajib diisi.' })
        .min(8, 'Kata sandi minimal 8 karakter.')
        .max(200, 'Kata sandi terlalu panjang.'),
      passwordConfirm: z.string(),
      consent: z.literal('on', {
        errorMap: () => ({ message: 'Anda perlu menyetujui penggunaan data untuk pelatihan.' }),
      }),
    })
    .refine((v) => v.password === v.passwordConfirm, {
      path: ['passwordConfirm'],
      message: 'Konfirmasi kata sandi tidak sama.',
    });
}

export type Registration = z.infer<ReturnType<typeof registrationSchema>>;
export type Profile = z.infer<ReturnType<typeof profileSchema>>;

/**
 * Parses a registration form and reports every problem at once. The password
 * confirmation is checked separately because Zod skips object-level checks
 * while any field is invalid, which would hide it until the rest is fixed.
 */
export function parseRegistration(
  raw: Record<string, unknown>,
  today = new Date(),
): { ok: true; data: Registration } | { ok: false; errors: Record<string, string> } {
  const r = registrationSchema(today).safeParse(raw);
  if (r.success) return { ok: true, data: r.data };
  const errors = fieldErrors(r.error);
  if (raw.password !== raw.passwordConfirm) errors.passwordConfirm ??= 'Konfirmasi kata sandi tidak sama.';
  return { ok: false, errors };
}

/** First error message per field, for showing beside the inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    out[key] ??= issue.message;
  }
  return out;
}
