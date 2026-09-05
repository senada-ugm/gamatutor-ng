import type { PageOfType } from '@gamatutor/course-schema';
import type { RenderContext } from '../context.js';
import { cardShell, setCard, wireFooterNav } from '../chrome/shell.js';
import { esc } from '../dom.js';

/**
 * A standalone video page. The DRIVE course does not use this — its video is a
 * reveal step inside a content page — but the type exists for future courses.
 */
export function renderVideo(ctx: RenderContext, page: PageOfType<'video'>): void {
  const poster = page.poster ? ` poster="${page.poster}"` : '';
  const captions = page.captions
    ? `<track kind="captions" srclang="${ctx.course.language}" src="${page.captions}" default>`
    : '';
  const body = `
    ${page.title ? `<h2>${esc(page.title)}</h2><div class="title-underline"></div>` : '<div style="height:14px"></div>'}
    <div class="anim-stack"><div class="anim-step"><video class="anim-video" controls${poster} src="${page.src}">${captions}</video></div></div>
  `;
  setCard(ctx, cardShell(ctx, body));
  wireFooterNav(ctx);
}
