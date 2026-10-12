import type { PageOfType } from '@gamatutor/course-schema';
import { statement } from '@gamatutor/tracking';
import type { RenderContext } from '../context.js';
import { cardShell, setCard, wireFooterNav } from '../chrome/shell.js';
import { esc } from '../dom.js';

type GradingPage = PageOfType<'image-grading'>;
type Lesion = GradingPage['lesions'][number];

/** How far a badge sits from its lesion by default, in % of the image. */
const OFFSET = 16;
/** The arrow stops this short of the lesion so its tip never covers it. */
const GAP = 2.2;
/** Badge radius in % of the image, so the arrow starts at its edge. */
const BADGE_R = 3.4;

const clamp = (v: number) => Math.min(94, Math.max(6, v));

/**
 * Where a lesion's numbered badge goes: at `dx/dy` from the lesion when the
 * course says so, otherwise pushed outward from the image centre, where the
 * fundus has the least to hide. Always kept inside the image.
 */
export function badgePosition(l: Lesion): { x: number; y: number } {
  if (l.dx !== undefined || l.dy !== undefined) {
    return { x: clamp(l.x + (l.dx ?? 0)), y: clamp(l.y + (l.dy ?? 0)) };
  }
  let vx = l.x - 50;
  let vy = l.y - 50;
  const len = Math.hypot(vx, vy);
  if (len < 1) {
    vx = -1;
    vy = -1;
  }
  const n = Math.hypot(vx, vy);
  return { x: clamp(l.x + (vx / n) * OFFSET), y: clamp(l.y + (vy / n) * OFFSET) };
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** One arrow from the badge's edge to just short of the lesion. */
export function arrowSvg(l: Lesion): string {
  const b = badgePosition(l);
  const dx = l.x - b.x;
  const dy = l.y - b.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const tip = { x: l.x - ux * GAP, y: l.y - uy * GAP };
  const start = { x: b.x + ux * BADGE_R, y: b.y + uy * BADGE_R };
  // Arrowhead: a small triangle at the tip.
  const back = { x: tip.x - ux * 3, y: tip.y - uy * 3 };
  const left = { x: back.x - uy * 1.7, y: back.y + ux * 1.7 };
  const right = { x: back.x + uy * 1.7, y: back.y - ux * 1.7 };
  return (
    `<line x1="${r2(start.x)}" y1="${r2(start.y)}" x2="${r2(back.x)}" y2="${r2(back.y)}" />` +
    `<polygon points="${r2(tip.x)},${r2(tip.y)} ${r2(left.x)},${r2(left.y)} ${r2(right.x)},${r2(right.y)}" />`
  );
}

/** Near the image's sides a centred label would be cut off; anchor it instead. */
function edgeClass(x: number): string {
  if (x < 25) return ' edge-l';
  if (x > 75) return ' edge-r';
  return '';
}

function pinsFor(ctx: RenderContext, page: GradingPage): boolean[] {
  let arr = ctx.state.gradingPins[page.id];
  if (!arr) {
    arr = page.lesions.map(() => false);
    ctx.state.gradingPins[page.id] = arr;
  }
  return arr;
}

export function renderImageGrading(ctx: RenderContext, page: GradingPage): void {
  const chosen = ctx.state.gradingChoice[page.id];
  const answered = chosen !== undefined;
  const right = chosen === page.correct;
  const pins = pinsFor(ctx, page);

  const optionsHtml = page.options
    .map((o) => {
      let cls = 'opt-row';
      if (answered) {
        cls += ' disabled';
        if (o === page.correct) cls += ' correct';
        else if (o === chosen) cls += ' wrong';
      }
      return `<label class="${cls}"><input type="radio" name="fopt" ${answered ? 'disabled' : ''} ${o === chosen ? 'checked' : ''} data-val="${esc(o)}"> ${esc(o)}</label>`;
    })
    .join('');

  const lesions = answered ? page.lesions : [];
  const arrowsHtml = lesions.length
    ? `<svg class="lesion-arrows" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lesions.map(arrowSvg).join('')}</svg>`
    : '';
  const badgesHtml = lesions
    .map((l, li) => {
      const b = badgePosition(l);
      const revealed = pins[li];
      const pos = `left:${r2(b.x)}%;top:${r2(b.y)}%`;
      return (
        `<button type="button" class="pin ${revealed ? 'revealed' : ''}" data-li="${li}" style="${pos}" aria-label="Lesi ${li + 1}${revealed ? ': ' + esc(l.label) : ''}">${li + 1}</button>` +
        // The name goes on the far side of the badge, never over the lesion.
        (revealed
          ? `<div class="pin-label${b.y > l.y ? ' below' : ''}${edgeClass(b.x)}" style="${pos}">${esc(l.label)}</div>`
          : '')
      );
    })
    .join('');

  const doneCount = pins.filter(Boolean).length;
  const totalLesions = page.lesions.length;

  let progress = '';
  if (answered && totalLesions) {
    progress = `<div class="fundus-progress">Lesi teridentifikasi: ${doneCount}/${totalLesions} &mdash; klik setiap nomor pada gambar untuk melihat nama lesinya.</div>`;
  } else if (answered) {
    progress = `<div class="fundus-progress">Tidak ada temuan pada gambar ini (normal).</div>`;
  }

  const verdict = right
    ? '<b>&#10003; Benar.</b>'
    : `<b>&#10007; Kurang tepat.</b> Jawaban yang benar: <b>${esc(page.correct)}</b>.`;
  const feedback = answered
    ? `<div class="reasoning-box${right ? '' : ' is-wrong'}" role="status">${verdict} <b>Alasan:</b> ${esc(page.reasoning || '(tidak ada catatan pada gambar ini)')}</div>`
    : '';

  const instruction =
    page.instruction ?? 'Amati foto fundus, lalu klik diagnosis yang paling tepat.';

  const body = `
    ${page.level ? `<div class="level-tag">${esc(page.level)}</div>` : ''}
    <h2>${esc(page.title ?? 'Simulasi Grading')}</h2>
    <div class="title-underline"></div>
    <div class="fundus-layout">
      <div class="fundus-stage" id="fundusStage">
        <img src="${page.image}" alt="Foto fundus untuk dinilai">
        ${arrowsHtml}
        ${badgesHtml}
      </div>
      <div class="fundus-side">
        ${answered ? '' : `<p class="page-instruction">${esc(instruction)}</p>`}
        <div class="opt-list" id="optList">${optionsHtml}</div>
        ${feedback}
        ${progress}
      </div>
    </div>
  `;
  setCard(ctx, cardShell(ctx, body));
  wireFooterNav(ctx);

  if (!answered) {
    ctx.document.querySelectorAll<HTMLElement>('#optList .opt-row').forEach((row) => {
      row.onclick = () => {
        const value = row.querySelector('input')?.getAttribute('data-val') ?? '';
        ctx.adapter.emit(
          statement('answered', page.id, {
            result: { response: value, success: value === page.correct },
          }),
        );
        ctx.state.gradingChoice[page.id] = value;
        ctx.rerender();
      };
    });
  }

  ctx.document.querySelectorAll<HTMLElement>('#fundusStage .pin').forEach((pinEl) => {
    pinEl.onclick = () => {
      const li = parseInt(pinEl.dataset['li']!, 10);
      const arr = pinsFor(ctx, page);
      if (arr[li]) return;
      arr[li] = true;
      ctx.adapter.emit(
        statement('interacted', page.id, {
          context: { lesionIndex: li, label: page.lesions[li]?.label },
        }),
      );
      ctx.rerender();
    };
  });
}
