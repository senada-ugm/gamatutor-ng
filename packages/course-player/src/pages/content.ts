import type { PageOfType } from '@gamatutor/course-schema';
import type { RenderContext } from '../context.js';
import { cardShell, setCard, wireFooterNav } from '../chrome/shell.js';
import { esc, kickerHtml, renderBodyBlock } from '../dom.js';
import { revealCount } from '../nav.js';
import { speakButtonHtml, wireSpeakButton } from '../narration.js';

type ContentPage = PageOfType<'content'>;
type RevealStep = NonNullable<ContentPage['reveal_steps']>[number];

export function renderContent(ctx: RenderContext, page: ContentPage): void {
  if (page.reveal_steps?.length) {
    renderAnimatedContent(ctx, page, page.reveal_steps);
    return;
  }
  const body = `
    ${kickerHtml(page)}
    ${page.title ? `<h2>${esc(page.title)}</h2><div class="title-underline"></div>` : '<div style="height:14px"></div>'}
    <div class="content-layout${page.imageLayout === 'below' ? ' stacked' : ''}">
      <div class="content-text">
        ${speakButtonHtml(ctx)}
        <div class="body-block">${renderBodyBlock(page.body)}</div>
      </div>
      ${page.image ? `<div class="content-image"><img src="${page.image}" alt="Ilustrasi slide ${page.slide}">${page.imageCaption ? `<div class="cap">${esc(page.imageCaption)}</div>` : ''}</div>` : ''}
    </div>
  `;
  setCard(ctx, cardShell(ctx, body));
  wireFooterNav(ctx);
  wireSpeakButton(ctx);
}

function stepHtml(step: RevealStep, cls: string, page: ContentPage): string {
  if ('video' in step) {
    const poster = step.video.poster ? ` poster="${step.video.poster}"` : '';
    return `<div class="${cls}"><video class="anim-video" controls preload="metadata"${poster} src="${step.video.src}"></video></div>`;
  }
  if ('image' in step && (step.title || step.body)) {
    return `<div class="${cls} icon-row"><img src="${step.image}" alt=""><div><h3>${esc(step.title || '')}</h3><p>${esc(step.body || '')}</p></div></div>`;
  }
  if ('image' in step) {
    return `<div class="${cls}"><img src="${step.image}" alt="Bagian slide ${page.slide}"></div>`;
  }
  if (step.texts.length > 1) {
    return `<div class="${cls}"><ul>${step.texts.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
  }
  return `<div class="${cls}"><p>${esc(step.texts[0])}</p></div>`;
}

/** Text and icon lists of four or more read better in two columns. */
export function revealColumns(page: ContentPage): 1 | 2 {
  if (page.revealColumns) return page.revealColumns;
  const steps = page.reveal_steps ?? [];
  const listLike = steps.every(
    (s) => ('texts' in s && s.texts.length === 1) || ('image' in s && (s.title || s.body)),
  );
  return listLike && steps.length >= 4 ? 2 : 1;
}

/** How many steps have already played their entrance, per player state. */
const animated = new WeakMap<object, Record<string, number>>();

function renderAnimatedContent(
  ctx: RenderContext,
  page: ContentPage,
  steps: readonly RevealStep[],
): void {
  const total = steps.length;
  const revealed = revealCount(ctx.state, page.id);
  const seen = animated.get(ctx.state) ?? {};
  animated.set(ctx.state, seen);
  const already = seen[page.id] ?? 0;
  seen[page.id] = Math.max(already, revealed);

  // Every step is drawn from the start so the layout never jumps; the ones
  // not reached yet are hidden but keep their place.
  const stepsHtml = steps
    .map((s, i) => {
      let cls = 'anim-step';
      if (i >= revealed) cls += ' anim-pending';
      else if (i >= already) cls += ' anim-in';
      return stepHtml(s, cls, page);
    })
    .join('');

  const stackAttrs =
    revealColumns(page) === 2
      ? `class="anim-stack two-col" style="--rows:${Math.ceil(total / 2)}"`
      : 'class="anim-stack"';
  const pace = ctx.narration.available ? 'mengikuti narasi' : 'bergantian';
  const hint =
    revealed < total
      ? `Bagian muncul ${pace} (${revealed}/${total}) &middot; klik &#8594; untuk mempercepat`
      : `&#10003; Semua bagian sudah ditampilkan.`;

  const body = `
    ${kickerHtml(page)}
    ${page.title ? `<h2>${esc(page.title)}</h2><div class="title-underline"></div>` : '<div style="height:14px"></div>'}
    ${speakButtonHtml(ctx)}
    ${page.body ? `<div class="body-block">${renderBodyBlock(page.body)}</div>` : ''}
    <div ${stackAttrs}>${stepsHtml}</div>
    <div class="anim-hint" aria-live="polite">${hint}</div>
  `;
  setCard(ctx, cardShell(ctx, body));
  wireFooterNav(ctx);
  wireSpeakButton(ctx);
}
