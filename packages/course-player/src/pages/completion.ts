import type { Score } from '@gamatutor/tracking';
import { statement } from '@gamatutor/tracking';
import type { RenderContext } from '../context.js';
import { setCard } from '../chrome/shell.js';
import { esc } from '../dom.js';
import { startRetake } from '../nav.js';
import { scoreCourse } from '../scoring.js';

const pct = (s: { raw: number; max: number }) => (s.max ? Math.round((s.raw / s.max) * 100) : 0);

export function isPassed(ctx: RenderContext, score: Score | null): boolean {
  return !score || (score.max > 0 && score.raw / score.max >= ctx.course.passingScore);
}

function learnerName(ctx: RenderContext): string | null {
  try {
    return ctx.adapter.learnerName?.() ?? null;
  } catch {
    return null;
  }
}

/** Reports the outcome once per attempt; the LMS keeps the latest. */
function report(ctx: RenderContext, score: Score | null, passed: boolean): void {
  const { state } = ctx;
  if (state.reportedAttempt === state.attempts.length) return;
  state.reportedAttempt = state.attempts.length;
  ctx.adapter.emit(
    statement(passed ? 'passed' : 'failed', ctx.course.id, {
      result: { success: passed, ...(score ? { score } : {}) },
      context: { attempt: state.attempts.length + 1 },
    }),
  );
  void ctx.adapter.finish({
    completed: true,
    ...(score ? { success: passed, score } : {}),
  });
}

function historyHtml(ctx: RenderContext): string {
  const { attempts } = ctx.state;
  if (!attempts.length) return '';
  const rows = attempts
    .map((a, i) => `<li>Percobaan ${i + 1}: ${a.raw} / ${a.max} (${pct(a)}%)</li>`)
    .join('');
  return `<div class="attempt-history"><b>Percobaan sebelumnya</b><ul>${rows}</ul></div>`;
}

export function renderCompletion(ctx: RenderContext): void {
  if (ctx.state.showCertificate) {
    renderCertificate(ctx);
    return;
  }
  const { course, state } = ctx;
  // The sidebar keeps reached modules open, so a learner on a retake can
  // arrive here before answering. Nothing is scored or reported until every
  // graded question of this attempt has an answer.
  const unanswered = unansweredQuiz(ctx);
  if (unanswered) {
    renderUnfinished(ctx, unanswered);
    return;
  }
  const score = scoreCourse(course, state);
  const passed = isPassed(ctx, score);
  report(ctx, score, passed);

  const limit = Math.round(course.passingScore * 100);
  const scoreHtml = score
    ? `<div class="score">Skor evaluasi: ${score.raw} / ${score.max} (${pct(score)}%)</div>
       <div class="pass-badge ${passed ? 'pass' : 'fail'}">${passed ? 'Lulus' : 'Belum lulus'} &middot; batas kelulusan ${limit}%</div>`
    : '';

  const name = learnerName(ctx);
  let decision: string;
  if (score && !state.satisfied) {
    decision = `
      <p class="satisfaction-q" id="satisfactionQ">Apakah Anda sudah puas dengan nilai Anda?</p>
      <div class="done-actions" role="group" aria-labelledby="satisfactionQ">
        <button class="done-primary" id="satisfiedBtn">Ya, sudah puas</button>
        <button class="done-secondary" id="retakeBtn">Belum, ulangi pelatihan</button>
      </div>`;
  } else if (!passed) {
    decision = `
      <p class="done-note">Nilai Anda belum mencapai batas kelulusan (${limit}%). Sertifikat diterbitkan setelah Anda lulus.</p>
      <div class="done-actions"><button class="done-primary" id="retakeBtn">Ulangi pelatihan</button></div>`;
  } else if (name && ctx.capabilities.certificate) {
    decision = `
      <p class="done-note">Sertifikat diterbitkan atas nama <b>${esc(name)}</b>, sesuai akun Anda.</p>
      <div class="done-actions">
        <button class="done-primary" id="certBtn">📜 Lihat sertifikat</button>
        <button class="done-secondary" id="retakeBtn">Ulangi pelatihan</button>
      </div>`;
  } else {
    decision = `
      <p class="done-note">Sertifikat diterbitkan atas nama akun Anda, jadi hanya tersedia setelah Anda masuk (login) ke platform pelatihan.</p>
      <div class="done-actions"><button class="done-secondary" id="retakeBtn">Ulangi pelatihan</button></div>`;
  }

  setCard(
    ctx,
    `
    <div class="done-screen">
      <h1>TERIMA KASIH</h1>
      <p>${esc(course.completion?.body ?? 'Anda telah menyelesaikan seluruh modul dan evaluasi pelatihan ini.')}</p>
      ${scoreHtml}
      ${historyHtml(ctx)}
      ${decision}
    </div>
  `,
  );

  const on = (id: string, fn: () => void) => {
    const el = ctx.document.getElementById(id);
    if (el) el.onclick = fn;
  };
  on('satisfiedBtn', () => {
    state.satisfied = true;
    ctx.rerender();
  });
  on('retakeBtn', () => {
    startRetake(
      course,
      state,
      score ? { raw: score.raw, max: score.max, at: new Date().toISOString() } : null,
    );
    ctx.rerender();
  });
  on('certBtn', () => {
    const issue = ctx.adapter.issueCertificate?.bind(ctx.adapter);
    if (!issue) {
      state.showCertificate = true;
      ctx.rerender();
      return;
    }
    // On the platform the certificate is issued and kept by the server.
    const btn = ctx.document.getElementById('certBtn') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Menerbitkan sertifikat…';
    issue().then(
      (url) => ctx.window.location.assign(url),
      () => {
        btn.disabled = false;
        btn.textContent = '📜 Lihat sertifikat';
        ctx.window.alert('Sertifikat belum bisa diterbitkan. Coba lagi sebentar.');
      },
    );
  });
}

interface QuizSpot {
  moduleIdx: number;
  pageIdx: number;
  answered: number;
  total: number;
}

function unansweredQuiz(ctx: RenderContext): QuizSpot | null {
  let first: Omit<QuizSpot, 'answered' | 'total'> | null = null;
  let answered = 0;
  let total = 0;
  ctx.course.modules.forEach((m, mi) =>
    m.pages.forEach((p, pi) => {
      if (p.type !== 'quiz' || !p.graded) return;
      total++;
      if (ctx.state.quizAnswers[p.id]) answered++;
      else first ??= { moduleIdx: mi, pageIdx: pi };
    }),
  );
  return first ? { ...(first as Omit<QuizSpot, 'answered' | 'total'>), answered, total } : null;
}

function renderUnfinished(ctx: RenderContext, spot: QuizSpot): void {
  setCard(
    ctx,
    `
    <div class="done-screen">
      <h1>EVALUASI BELUM SELESAI</h1>
      <p>Anda baru menjawab ${spot.answered} dari ${spot.total} soal evaluasi. Nilai dihitung setelah semua soal dijawab.</p>
      <div class="done-actions"><button class="done-primary" id="toQuizBtn">Lanjutkan evaluasi</button></div>
    </div>
  `,
  );
  ctx.document.getElementById('toQuizBtn')!.onclick = () => {
    ctx.state.moduleIdx = spot.moduleIdx;
    ctx.state.pageIdx = spot.pageIdx;
    ctx.rerender();
  };
}

export function renderCertificate(ctx: RenderContext): void {
  const name = learnerName(ctx);
  const score = scoreCourse(ctx.course, ctx.state);
  if (!name || !isPassed(ctx, score)) {
    // Never print a certificate without a signed-in name and a pass.
    ctx.state.showCertificate = false;
    renderCompletion(ctx);
    return;
  }
  const WindowDate = (ctx.window as unknown as { Date: DateConstructor }).Date;
  const dateStr = new WindowDate().toLocaleDateString(ctx.course.language, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const desc =
    ctx.course.completion?.certificateText ??
    `telah menyelesaikan pelatihan “${ctx.course.title}”.`;
  setCard(
    ctx,
    `
    <div class="certificate-wrap">
      <div class="certificate">
        <div class="cert-eyebrow">SERTIFIKAT PENYELESAIAN</div>
        <h1>${esc(ctx.course.brand.name)}</h1>
        <div class="cert-given">Dengan ini menyatakan bahwa</div>
        <div class="cert-name">${esc(name)}</div>
        <div class="cert-desc">${esc(desc)}</div>
        <div class="cert-meta">
          <div><b>${dateStr}</b>Tanggal selesai</div>
          ${score ? `<div><b>${score.raw} / ${score.max}</b>Skor evaluasi</div>` : ''}
        </div>
      </div>
      <div class="cert-actions">
        <button class="cert-print-btn" id="printCertBtn">🖨 Cetak / Simpan sebagai PDF</button>
        <button class="cert-back-btn" id="backFromCertBtn">&#8592; Kembali</button>
      </div>
    </div>
  `,
  );
  ctx.document.getElementById('printCertBtn')!.onclick = () => {
    ctx.window.print();
  };
  ctx.document.getElementById('backFromCertBtn')!.onclick = () => {
    ctx.state.showCertificate = false;
    ctx.rerender();
  };
}
