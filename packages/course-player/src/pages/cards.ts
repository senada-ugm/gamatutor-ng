import type { PageOfType } from '@gamatutor/course-schema';
import type { RenderContext } from '../context.js';
import { cardShell, setCard, wireFooterNav } from '../chrome/shell.js';
import { esc, kickerHtml } from '../dom.js';
import { speakButtonHtml, wireSpeakButton } from '../narration.js';

export function renderCards(ctx: RenderContext, page: PageOfType<'cards'>): void {
  const cols = page.columns || (page.cards.length >= 3 ? 3 : 2);
  const cardsHtml = page.cards
    .map((c) => {
      if (c.big !== undefined) {
        return `<div class="feature-card stat ${c.dark ? 'dark' : ''}"><div class="big">${esc(c.big)}</div><p>${esc(c.body)}</p></div>`;
      }
      return `<div class="feature-card"><h3>${esc(c.title)}</h3><p>${esc(c.body)}</p></div>`;
    })
    .join('');

  const trailing = page.trailingImage
    ? `
    <div class="cards-trailing">
      <div><img src="${page.trailingImage}" alt="Ilustrasi slide ${page.slide}">${page.trailingCaption ? `<div class="cap">${esc(page.trailingCaption)}</div>` : ''}</div>
      ${page.trailingNote ? `<div class="cards-note">${esc(page.trailingNote)}</div>` : ''}
    </div>`
    : '';

  const body = `
    ${kickerHtml(page)}
    <h2>${esc(page.title)}</h2>
    <div class="title-underline"></div>
    ${page.intro ? `<p style="font-size:14px;color:#334;margin:0 0 14px;line-height:1.6;">${esc(page.intro)}</p>` : ''}
    ${speakButtonHtml(ctx)}
    <div class="cards-grid cols-${cols}">${cardsHtml}</div>
    ${trailing}
  `;
  setCard(ctx, cardShell(ctx, body));
  wireFooterNav(ctx);
  wireSpeakButton(ctx);
}
