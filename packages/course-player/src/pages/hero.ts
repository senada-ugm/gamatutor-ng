import type { PageOfType } from '@gamatutor/course-schema';
import type { RenderContext } from '../context.js';
import { setCard } from '../chrome/shell.js';
import { esc } from '../dom.js';

/** The course opener. Has no footer nav — it launches with #launchBtn. */
export function renderHero(ctx: RenderContext, page: PageOfType<'hero'>): void {
  setCard(
    ctx,
    `
    <div class="hero">
      <img class="hero-bg-img" src="assets/hero-illustration.svg" alt="">
      <div class="hero-content">
        <h1>${esc(page.title)}</h1>
        <p>${esc(page.body)}</p>
        <button class="launch-btn" id="launchBtn">MULAI &#8594;</button>
      </div>
    </div>
  `,
  );
  const btn = ctx.document.getElementById('launchBtn');
  if (btn) btn.onclick = ctx.goNext;
}
