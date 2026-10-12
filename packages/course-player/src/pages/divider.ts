import type { PageOfType } from '@gamatutor/course-schema';
import type { RenderContext } from '../context.js';
import { setCard, wireFooterNav } from '../chrome/shell.js';
import { esc } from '../dom.js';
import { FOOTER_LINKS } from '../chrome/panels.js';
import { progressFillPct, globalPageNumber, totalPages } from '../nav.js';

/**
 * Chapter break. Deliberately does NOT use cardShell — it has no brand header.
 */
export function renderDivider(ctx: RenderContext, page: PageOfType<'divider'>): void {
  const { course, state } = ctx;
  setCard(
    ctx,
    `
    <div class="card-top-progress"><div class="fill" style="width:${progressFillPct(course, state)}%"></div></div>
    <div class="divider-screen">
      ${page.kicker ? `<div class="divider-kicker">${esc(page.kicker)}</div>` : ''}
      <div class="divider-title">${esc(page.title || '')}</div>
    </div>
    <div class="card-footer">
      ${FOOTER_LINKS}
      <div class="nav-arrows">
        <button id="prevBtn" aria-label="Halaman sebelumnya">&#8592;</button>
        <span class="page-indicator">${globalPageNumber(course, state)} / ${totalPages(course)}</span>
        <button id="nextBtn" aria-label="Halaman berikutnya">&#8594;</button>
      </div>
    </div>
  `,
  );
  wireFooterNav(ctx);
}
