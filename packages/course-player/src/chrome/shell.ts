import type { RenderContext } from '../context.js';
import { globalPageNumber, progressFillPct, totalPages } from '../nav.js';
import { autoNarrationEnabled, setAutoNarration } from '../narration.js';
import { FOOTER_LINKS, wireFooterLinks } from './panels.js';

/**
 * The card frame every non-hero page renders inside: progress bar, brand
 * header, body, and the footer with the prev/next arrows.
 */
export function cardShell(
  ctx: RenderContext,
  innerBody: string,
  opts: { pageLabel?: string } = {},
) {
  const { course, state } = ctx;
  const atFirst = state.moduleIdx === 0 && state.pageIdx === 0;
  const atLast = state.moduleIdx === course.modules.length - 1;
  const pageLabel = opts.pageLabel || `${globalPageNumber(course, state)} / ${totalPages(course)}`;
  return `
    <div class="card-top-progress"><div class="fill" style="width:${progressFillPct(course, state)}%"></div></div>
    <div class="card-header">
      ${autoNarrationSwitch(ctx)}
      <div class="brandlogo"><div class="mark">${course.brand.mark}</div> ${course.brand.name}</div>
    </div>
    <div class="card-body"><div class="page">${innerBody}</div></div>
    <div class="card-footer">
      ${FOOTER_LINKS}
      <div class="nav-arrows">
        <button id="prevBtn" aria-label="Halaman sebelumnya" ${atFirst ? 'disabled' : ''}>&#8592;</button>
        <span class="page-indicator">${pageLabel}</span>
        <button id="nextBtn" aria-label="Halaman berikutnya" ${atLast ? 'disabled' : ''}>&#8594;</button>
      </div>
    </div>
  `;
}

/** The learner's autoplay preference; hidden when the course has no voice. */
function autoNarrationSwitch(ctx: RenderContext): string {
  if (ctx.capabilities.narration === 'off') return '<div></div>';
  const on = autoNarrationEnabled(ctx.window);
  return `<button type="button" class="auto-narration" id="autoNarrationBtn" aria-pressed="${on}">${on ? '🔊' : '🔇'} Narasi otomatis: <b>${on ? 'Aktif' : 'Mati'}</b></button>`;
}

function wireAutoNarration(ctx: RenderContext): void {
  const btn = ctx.document.getElementById('autoNarrationBtn');
  if (!btn) return;
  btn.onclick = () => {
    const on = !autoNarrationEnabled(ctx.window);
    setAutoNarration(ctx.window, on);
    // Follow the switch on the current page too, not only from the next one.
    if (on !== ctx.narration.playing && ctx.narration.available) ctx.narration.toggle();
    btn.setAttribute('aria-pressed', String(on));
    btn.innerHTML = `${on ? '🔊' : '🔇'} Narasi otomatis: <b>${on ? 'Aktif' : 'Mati'}</b>`;
  };
}

export function wireFooterNav(ctx: RenderContext): void {
  wireAutoNarration(ctx);
  const prevBtn = ctx.document.getElementById('prevBtn');
  const nextBtn = ctx.document.getElementById('nextBtn');
  if (prevBtn) prevBtn.onclick = ctx.goPrev;
  if (nextBtn) nextBtn.onclick = ctx.goNext;
  wireFooterLinks(ctx);
}

export function setCard(ctx: RenderContext, html: string): void {
  const card = ctx.document.getElementById('contentCard');
  if (!card) throw new Error('course-player: no #contentCard element to render into');
  card.innerHTML = html;
}
