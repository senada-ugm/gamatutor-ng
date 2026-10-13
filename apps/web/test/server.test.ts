import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../src/db/client';
import { AccountError, login, registerUser, updateProfile, userForSession, verifyEmail } from '../src/server/accounts';
import { catalogue, enrol, learningContext, publishCourse } from '../src/server/catalogue';
import { certificateBySerial, ingest, issueCertificate, saveResumeState, type IncomingEvent } from '../src/server/learning';
import { hashPassword, verifyPassword } from '../src/server/password';
import { parseRegistration, registrationSchema } from '../src/server/registration';
import { courseReport, eventsCsv, learnersCsv } from '../src/server/reports';

let db: Db;
const storage = mkdtempSync(join(tmpdir(), 'gt-storage-'));

const TODAY = new Date('2026-10-13T00:00:00Z');
const form = (over: Record<string, string> = {}) => ({
  fullName: 'dr. Ayu  Putri',
  birthDate: '1990-05-17',
  profession: 'Dokter umum',
  institution: 'Puskesmas Depok I',
  province: 'DI Yogyakarta',
  city: 'Sleman',
  phone: '+62 812-3456-7890',
  email: 'Ayu@Example.ID',
  password: 'rahasia-sekali',
  passwordConfirm: 'rahasia-sekali',
  consent: 'on',
  ...over,
});

async function newLearner(email: string) {
  const input = registrationSchema(TODAY).parse(form({ email }));
  const { user, verifyToken } = await registerUser(db, input);
  await verifyEmail(db, verifyToken);
  return user;
}

const ev = (verb: string, objectId: string, at: string, extra: Partial<IncomingEvent> = {}): IncomingEvent => ({
  clientEventId: randomUUID(),
  verb,
  objectId,
  timestamp: at,
  ...extra,
});

beforeAll(async () => {
  db = await openDb('memory://');
  await publishCourse(db, {
    courseDir: 'content/drive-retinopati',
    topicSlug: 'retina',
    topicTitle: 'Retina',
    summary: 'Skrining retinopati diabetika untuk layanan primer.',
    storage,
  });
}, 60_000);

describe('passwords', () => {
  it('verifies the right password and rejects others', async () => {
    const h = await hashPassword('benar-sekali');
    expect(await verifyPassword('benar-sekali', h)).toBe(true);
    expect(await verifyPassword('salah', h)).toBe(false);
    expect(await verifyPassword('x', 'garbage')).toBe(false);
  });
});

describe('registration (note 11)', () => {
  it('normalises name, email and phone', () => {
    const v = registrationSchema(TODAY).parse(form());
    expect(v).toMatchObject({ fullName: 'dr. Ayu Putri', email: 'ayu@example.id', phone: '081234567890' });
  });

  it('explains every missing or wrong field in Indonesian', () => {
    const r = parseRegistration(
      form({ fullName: '', birthDate: '2015-01-01', phone: '12', passwordConfirm: 'beda', consent: '' }),
      TODAY,
    );
    if (r.ok) throw new Error('should fail');
    const errs = r.errors;
    expect(errs.fullName).toContain('wajib');
    expect(errs.birthDate).toContain('17');
    expect(errs.phone).toContain('tidak valid');
    expect(errs.passwordConfirm).toContain('tidak sama');
    expect(errs.consent).toBeDefined();
  });

  it('requires a verified email before login, and refuses a second account on the same email', async () => {
    const input = registrationSchema(TODAY).parse(form({ email: 'budi@example.id' }));
    const { verifyToken } = await registerUser(db, input);
    await expect(login(db, 'budi@example.id', 'rahasia-sekali')).rejects.toMatchObject({ code: 'unverified' });
    await expect(registerUser(db, input)).rejects.toBeInstanceOf(AccountError);
    await verifyEmail(db, verifyToken);
    await expect(verifyEmail(db, verifyToken)).rejects.toMatchObject({ code: 'bad-token' });
    const { token } = await login(db, 'BUDI@example.id ', 'rahasia-sekali');
    expect((await userForSession(db, token))?.email).toBe('budi@example.id');
    await expect(login(db, 'budi@example.id', 'salah')).rejects.toMatchObject({ code: 'bad-login' });
  });
});

describe('catalogue (note 13)', () => {
  it('groups published courses by topic with the learner state', async () => {
    const u = await newLearner('citra@example.id');
    let groups = await catalogue(db, u.id);
    expect(groups.map((g) => g.title)).toEqual(['Retina']);
    expect(groups[0]!.courses[0]).toMatchObject({ slug: 'drive-retinopati', state: 'baru' });
    await enrol(db, u.id, 'drive-retinopati');
    groups = await catalogue(db, u.id);
    expect(groups[0]!.courses[0]!.state).toBe('berjalan');
  });

  it('does not republish an unchanged course', async () => {
    const again = await publishCourse(db, {
      courseDir: 'content/drive-retinopati',
      topicSlug: 'retina',
      topicTitle: 'Retina',
      storage,
    });
    expect(again.unchanged).toBe(true);
  });

  it('publishes a second version without moving enrolled learners', async () => {
    const u = await newLearner('dewi@example.id');
    await enrol(db, u.id, 'drive-retinopati');
    const before = await learningContext(db, u.id, 'drive-retinopati');
    // A changed course (here: a copy with an edited title) is a new version.
    const edited = mkdtempSync(join(tmpdir(), 'gt-course-'));
    const json = JSON.parse(readFileSync('content/drive-retinopati/course.json', 'utf8'));
    writeFileSync(join(edited, 'course.json'), JSON.stringify({ ...json, title: json.title + ' (rev)' }));
    const { version } = await publishCourse(db, {
      courseDir: edited,
      topicSlug: 'retina',
      topicTitle: 'Retina',
      storage,
    });
    expect(version.version).toBeGreaterThan(before!.version.version);
    const after = await learningContext(db, u.id, 'drive-retinopati');
    expect(after!.version.id).toBe(before!.version.id);
  });
});

describe('events, results and certificates (notes 9, 10, 15)', () => {
  it('ingests idempotently and only into the caller\'s own attempt', async () => {
    const u = await newLearner('eka@example.id');
    const other = await newLearner('fajar@example.id');
    await enrol(db, u.id, 'drive-retinopati');
    const ctx = (await learningContext(db, u.id, 'drive-retinopati'))!;
    const batch = [ev('experienced', 'modul1-p2', '2026-10-13T02:00:00Z')];
    expect((await ingest(db, u.id, ctx.attempt.id, batch)).accepted).toBe(1);
    expect((await ingest(db, u.id, ctx.attempt.id, batch)).accepted).toBe(0);
    await expect(ingest(db, other.id, ctx.attempt.id, batch)).rejects.toThrow();
  });

  it('records results per attempt and issues one certificate in the account name, frozen', async () => {
    const u = await newLearner('gita@example.id');
    await enrol(db, u.id, 'drive-retinopati');
    const ctx = (await learningContext(db, u.id, 'drive-retinopati'))!;
    const score = (raw: number) => ({ score: { raw, min: 0, max: 5 } });
    await ingest(db, u.id, ctx.attempt.id, [
      ev('failed', 'drive-retinopati', '2026-10-13T03:00:00Z', { result: { success: false, ...score(2) }, context: { attempt: 1 } }),
    ]);
    await expect(issueCertificate(db, u.id, ctx.attempt.id)).rejects.toThrow('lulus');
    await ingest(db, u.id, ctx.attempt.id, [
      ev('passed', 'drive-retinopati', '2026-10-13T04:00:00Z', { result: { success: true, ...score(5) }, context: { attempt: 2 } }),
    ]);
    const cert = await issueCertificate(db, u.id, ctx.attempt.id);
    expect(cert.snapshot).toMatchObject({ name: 'dr. Ayu Putri', scoreRaw: 5, scoreMax: 5 });
    expect((await issueCertificate(db, u.id, ctx.attempt.id)).serial).toBe(cert.serial);

    const v = registrationSchema(TODAY).parse(form({ email: 'gita@example.id' }));
    await updateProfile(db, u.id, { ...v, fullName: 'Nama Lain' });
    const found = await certificateBySerial(db, cert.serial.toLowerCase());
    expect((found!.cert.snapshot as { name: string }).name).toBe('dr. Ayu Putri');

    const history = (await learningContext(db, u.id, 'drive-retinopati'))!.history;
    expect(history.map((h) => [h.attemptNo, h.passed])).toEqual([[1, false], [2, true]]);
  });

  it('stores the resume state for the next visit', async () => {
    const u = await newLearner('hana@example.id');
    await enrol(db, u.id, 'drive-retinopati');
    const ctx = (await learningContext(db, u.id, 'drive-retinopati'))!;
    await saveResumeState(db, u.id, ctx.attempt.id, { moduleIdx: 2, pageIdx: 3 });
    const again = (await learningContext(db, u.id, 'drive-retinopati'))!;
    expect(again.attempt.resumeState).toEqual({ moduleIdx: 2, pageIdx: 3 });
  });
});

describe('admin report (note 15)', () => {
  it('reports active time, sessions, access hours in WIB, and exports CSV', async () => {
    const u = await newLearner('indah@example.id');
    await enrol(db, u.id, 'drive-retinopati');
    const ctx = (await learningContext(db, u.id, 'drive-retinopati'))!;
    // 20:00 WIB Monday: three minutes of activity, then a new session next day.
    await ingest(db, u.id, ctx.attempt.id, [
      ev('experienced', 'modul1-p2', '2026-10-12T13:00:00Z'),
      ev('heartbeat', 'modul1-p2', '2026-10-12T13:01:00Z'),
      ev('experienced', 'modul1-p3', '2026-10-12T13:03:00Z'),
      ev('experienced', 'modul2-p2', '2026-10-13T01:00:00Z'),
    ]);
    const report = (await courseReport(db, 'drive-retinopati', new Date('2026-10-13T05:00:00Z')))!;
    const row = report.learners.find((l) => l.email === 'indah@example.id')!;
    expect(row.activeMs).toBe(3 * 60_000);
    expect(row.sessions).toBe(2);
    expect(report.heatmap[0]![20]).toBeGreaterThanOrEqual(3); // Monday 20:00 WIB
    expect(report.modules.find((m) => m.module.startsWith('Modul 1'))!.medianMinutes).toBeGreaterThan(0);
    expect(report.daily.at(-1)!.date).toBe('2026-10-13');

    const csv = learnersCsv(report.learners);
    expect(csv.startsWith('﻿nama_lengkap,')).toBe(true);
    expect(csv).toContain('indah@example.id');
    const raw = (await eventsCsv(db, 'drive-retinopati'))!;
    expect(raw).toContain('2026-10-12 20:00');
    expect(raw).toContain('heartbeat');
  });
});
