import type { PageOfType } from '@gamatutor/course-schema';
import type { RenderContext } from '../context.js';
import { cardShell, setCard, wireFooterNav } from '../chrome/shell.js';
import { attr, esc, kickerHtml } from '../dom.js';

/**
 * An interactive from the course's own assets, in a frame. The frame is capped
 * to the viewport height so the footer arrows stay reachable on a phone; the
 * optional full-page link opens the same interactive in its own tab.
 */
export function renderEmbed(ctx: RenderContext, page: PageOfType<'embed'>): void {
  const open = page.fullPage
    ? `<a href="${attr(ctx.asset(page.fullPage))}" target="_blank" rel="noopener">Buka di jendela baru</a>`
    : '';
  const foot =
    page.caption || open
      ? `<div class="embed-foot"><span>${esc(page.caption)}</span>${open}</div>`
      : '';
  const body = `
    ${kickerHtml(page)}
    <h2>${esc(page.title)}</h2>
    <div class="title-underline"></div>
    ${page.intro ? `<p class="embed-intro">${esc(page.intro)}</p>` : ''}
    <div class="embed-frame" style="--embed-h:${page.height ?? 600}px">
      <iframe src="${attr(ctx.asset(page.src))}" title="${attr(page.title)}" allow="fullscreen" allowfullscreen></iframe>
    </div>
    ${foot}
  `;
  setCard(ctx, cardShell(ctx, body));
  wireFooterNav(ctx);
}
