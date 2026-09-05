import type { RenderContext } from '../context.js';
import { setCard } from '../chrome/shell.js';
import { esc } from '../dom.js';
import { createState } from '../nav.js';
import { stopSpeech } from '../narration.js';
import { scoreCourse } from '../scoring.js';

export function renderCompletion(ctx: RenderContext): void {
  if (ctx.state.showCertificate) {
    renderCertificate(ctx);
    return;
  }
  const score = scoreCourse(ctx.course, ctx.state);

  // Completion reporting is the adapter's job now — the original wrote the
  // SCORM CMI values inline here.
  void ctx.adapter.finish({
    completed: true,
    ...(score ? { score } : {}),
  });

  setCard(
    ctx,
    `
    <div class="done-screen">
      <h1>TERIMA KASIH</h1>
      <p>Anda telah menyelesaikan Modul 1&ndash;4 (Bab 1&ndash;3, simulasi grading) dan evaluasi &mdash; Pelatihan Skrining Retinopati Diabetika.</p>
      ${score ? `<div class="score">Skor evaluasi: ${score.raw} / ${score.max}</div>` : ''}
      <p style="font-size:12px;opacity:.75;">Seluruh teks, gambar, narasi, titik lesi, dan soal pada kursus ini diekstrak dari file PPTX "SAMPLE MIPA_Modul_DRIVE.pptx".</p>
      <div class="cert-form">
        <input type="text" id="learnerNameInput" placeholder="Masukkan nama lengkap Anda" value="${esc(ctx.state.learnerName)}">
        <button id="certBtn">📜 Buat Sertifikat</button>
      </div>
      <button class="restart-btn" id="restartBtn">Ulangi Kursus</button>
    </div>
  `,
  );

  const certBtn = ctx.document.getElementById('certBtn')!;
  const nameInput = ctx.document.getElementById('learnerNameInput') as HTMLInputElement;

  certBtn.onclick = () => {
    const val = nameInput.value.trim();
    if (!val) {
      ctx.window.alert('Mohon isi nama Anda terlebih dahulu.');
      return;
    }
    ctx.state.learnerName = val;
    ctx.state.showCertificate = true;
    ctx.rerender();
  };
  nameInput.onkeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') certBtn.click();
  };
  ctx.document.getElementById('restartBtn')!.onclick = () => {
    stopSpeech(ctx);
    Object.assign(ctx.state, createState());
    ctx.rerender();
  };
}

export function renderCertificate(ctx: RenderContext): void {
  const score = scoreCourse(ctx.course, ctx.state);
  const WindowDate = (ctx.window as unknown as { Date: DateConstructor }).Date;
  const dateStr = new WindowDate().toLocaleDateString(ctx.course.language, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  setCard(
    ctx,
    `
    <div class="certificate-wrap">
      <div class="certificate">
        <div class="cert-eyebrow">SERTIFIKAT PENYELESAIAN</div>
        <h1>${ctx.course.brand.name}</h1>
        <div class="cert-given">Dengan ini menyatakan bahwa</div>
        <div class="cert-name">${esc(ctx.state.learnerName)}</div>
        <div class="cert-desc">telah menyelesaikan pelatihan <b>&ldquo;Skrining Retinopati Diabetika untuk Dokter Layanan Primer&rdquo;</b>, mencakup Modul 1&ndash;4 (Diabetes Mellitus, Retinopati Diabetika, Skrining &amp; Tatalaksana, Simulasi Grading) beserta evaluasi pre/post-test.</div>
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
