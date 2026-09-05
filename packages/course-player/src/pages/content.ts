import type { PageOfType } from '@gamatutor/course-schema';
import type { RenderContext } from '../context.js';
import { cardShell, setCard, wireFooterNav } from '../chrome/shell.js';
import { esc, kickerHtml, renderBodyBlock } from '../dom.js';
import { revealCount } from '../nav.js';
import { wireSpeakButton } from '../narration.js';

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
        ${page.transcript ? `<div class="speak-row"><button class="speak-btn" id="speakBtn">🔊 Dengarkan Narasi</button></div>` : ''}
        <div class="body-block">${renderBodyBlock(page.body)}</div>
      </div>
      ${page.image ? `<div class="content-image"><img src="${page.image}" alt="Ilustrasi slide ${page.slide}">${page.imageCaption ? `<div class="cap">${esc(page.imageCaption)}</div>` : ''}</div>` : ''}
    </div>
  `;
  setCard(ctx, cardShell(ctx, body));
  wireFooterNav(ctx);
  wireSpeakButton(ctx, page.transcript);
}

function stepHtml(step: RevealStep, cls: string, page: ContentPage): string {
  if ('video' in step) {
    const poster = step.video.poster ? ` poster="${step.video.poster}"` : '';
    return `<div class="${cls}"><video class="anim-video" controls${poster} src="${step.video.src}"></video></div>`;
  }
  if ('image' in step && (step.title || step.body)) {
    return `<div class="${cls} icon-row"><img src="${step.image}" alt=""><div><h3>${esc(step.title || '')}</h3><p>${esc(step.body || '')}</p></div></div>`;
  }
  if ('image' in step) {
    return `<div class="${cls}"><img src="${step.image}" alt="Bagian slide ${page.slide}"></div>`;
  }
  return `<div class="${cls}"><p>${esc(('texts' in step ? step.texts : []).join(' '))}</p></div>`;
}

function renderAnimatedContent(
  ctx: RenderContext,
  page: ContentPage,
  steps: readonly RevealStep[],
): void {
  const total = steps.length;
  const revealed = revealCount(ctx.state, page.id);
  const stepsHtml = steps
    .slice(0, revealed)
    .map((s, i) => stepHtml(s, 'anim-step' + (i === revealed - 1 ? ' anim-in' : ''), page))
    .join('');

  const notYetDone = revealed < total;

  const body = `
    ${kickerHtml(page)}
    ${page.title ? `<h2>${esc(page.title)}</h2><div class="title-underline"></div>` : '<div style="height:14px"></div>'}
    ${page.transcript ? `<div class="speak-row"><button class="speak-btn" id="speakBtn">🔊 Dengarkan Narasi</button></div>` : ''}
    ${page.body ? `<div class="body-block">${renderBodyBlock(page.body)}</div>` : ''}
    <div class="anim-stack">${stepsHtml}</div>
    <div class="anim-hint">${notYetDone ? `Klik &#8594; untuk melanjutkan (${revealed}/${total})` : `&#10003; Semua bagian slide ini sudah ditampilkan.`}</div>
  `;
  setCard(ctx, cardShell(ctx, body));
  wireFooterNav(ctx);
  wireSpeakButton(ctx, page.transcript);
}
