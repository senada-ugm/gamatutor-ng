import type { RenderContext } from '../context.js';
import { esc } from '../dom.js';

/**
 * The three footer links the original course drew but never wired. Their
 * markup stays exactly as the original had it — only `role`/`tabindex` are
 * added, which characterisation parity already allows — and they open a panel
 * outside #contentCard, so no rendered card changes.
 */
export const FOOTER_LINKS =
  '<div class="footer-links"><span role="button" tabindex="0">📄 Transkrip</span><span role="button" tabindex="0">❓ Bantuan</span><span role="button" tabindex="0">🔗 Referensi</span></div>';

const PANEL_ID = 'gtPanel';

function currentPage(ctx: RenderContext) {
  return ctx.course.modules[ctx.state.moduleIdx]?.pages[ctx.state.pageIdx];
}

function transcriptBody(ctx: RenderContext): string {
  const page = currentPage(ctx);
  const text = page && 'transcript' in page ? page.transcript : undefined;
  if (text) return `<p>${esc(text)}</p>`;
  return '<p class="gt-panel-empty">Halaman ini tidak memiliki narasi, jadi tidak ada transkrip.</p>';
}

const HELP = `
  <ul>
    <li>Tombol &#8594; dan &#8592; di kanan bawah berpindah halaman. Pada halaman bertahap, &#8594; membuka bagian berikutnya lebih dulu.</li>
    <li>Modul di sidebar terbuka berurutan. Modul berikutnya terbuka setelah Anda mencapai halaman pertamanya.</li>
    <li>Pada soal evaluasi, pilih jawaban dulu sebelum lanjut.</li>
    <li>Tombol 🔊 membacakan narasi halaman. Teks narasinya ada di Transkrip.</li>
  </ul>`;

const REFERENCES =
  '<p class="gt-panel-empty">Daftar referensi untuk kursus ini belum disusun. Sumber gambar dicantumkan di bawah gambarnya masing-masing.</p>';

export function closePanel(ctx: RenderContext): void {
  ctx.document.getElementById(PANEL_ID)?.remove();
}

function openPanel(ctx: RenderContext, title: string, body: string, from: HTMLElement): void {
  const doc = ctx.document;
  closePanel(ctx);
  const wrap = doc.createElement('div');
  wrap.id = PANEL_ID;
  wrap.className = 'gt-panel-backdrop';
  wrap.innerHTML = `
    <div class="gt-panel" role="dialog" aria-modal="true" aria-labelledby="gtPanelTitle">
      <div class="gt-panel-head"><h2 id="gtPanelTitle">${esc(title)}</h2>
        <button type="button" class="gt-panel-close" aria-label="Tutup">&times;</button></div>
      <div class="gt-panel-body">${body}</div>
    </div>`;
  const close = () => {
    wrap.remove();
    doc.removeEventListener('keydown', onKey);
    from.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) close();
  });
  wrap.querySelector<HTMLButtonElement>('.gt-panel-close')!.onclick = close;
  doc.addEventListener('keydown', onKey);
  doc.body.appendChild(wrap);
  wrap.querySelector<HTMLButtonElement>('.gt-panel-close')!.focus();
}

export function wireFooterLinks(ctx: RenderContext): void {
  closePanel(ctx);
  const links = ctx.document.querySelectorAll<HTMLElement>('#contentCard .footer-links span');
  const actions: Array<[string, () => string]> = [
    ['Transkrip', () => transcriptBody(ctx)],
    ['Bantuan', () => HELP],
    ['Referensi', () => REFERENCES],
  ];
  links.forEach((el, i) => {
    const action = actions[i];
    if (!action) return;
    const open = () => openPanel(ctx, action[0], action[1](), el);
    el.onclick = open;
    el.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    };
  });
}
