import type { PageOfType } from '@gamatutor/course-schema';
import { statement } from '@gamatutor/tracking';
import type { RenderContext } from '../context.js';
import { cardShell, setCard, wireFooterNav } from '../chrome/shell.js';
import { esc } from '../dom.js';

type GradingPage = PageOfType<'image-grading'>;

function pinsFor(ctx: RenderContext, page: GradingPage): boolean[] {
  let arr = ctx.state.gradingPins[page.id];
  if (!arr) {
    arr = page.lesions.map(() => false);
    ctx.state.gradingPins[page.id] = arr;
  }
  return arr;
}

export function renderImageGrading(ctx: RenderContext, page: GradingPage): void {
  const answered = !!ctx.state.gradingAnswered[page.id];
  const pins = pinsFor(ctx, page);

  const optionsHtml = page.options
    .map((o) => {
      let cls = 'opt-row';
      if (answered && o === page.correct) cls += ' correct';
      return `<label class="${cls}"><input type="radio" name="fopt" ${answered ? 'disabled' : ''} data-val="${esc(o)}"> ${esc(o)}</label>`;
    })
    .join('');

  const pinsHtml = (answered ? page.lesions : [])
    .map((l, li) => {
      const revealed = pins[li];
      return (
        `<div class="pin ${revealed ? 'revealed' : ''}" data-li="${li}" style="left:${l.x}%;top:${l.y}%">${li + 1}</div>` +
        (revealed
          ? `<div class="pin-label" style="left:${l.x}%;top:${l.y}%">${esc(l.label)}</div>`
          : '')
      );
    })
    .join('');

  const doneCount = pins.filter(Boolean).length;
  const totalLesions = page.lesions.length;

  const body = `
    <div class="level-tag">${esc(page.level)} &middot; Slide ${page.slide} dari PPTX asli</div>
    <h2>Simulasi Grading Retinopati Diabetika</h2>
    <div class="title-underline"></div>
    <div class="fundus-layout">
      <div class="fundus-stage" id="fundusStage">
        <img src="${page.image}" alt="Fundus ${page.slide}">
        ${pinsHtml}
      </div>
      <div class="fundus-side">
        <div class="opt-list" id="optList">${optionsHtml}</div>
        ${totalLesions ? `<div class="fundus-progress">Lesi teridentifikasi: ${doneCount}/${totalLesions} &mdash; klik titik pada gambar untuk melihat nama lesi.</div>` : answered ? `<div class="fundus-progress">Tidak ada temuan pada gambar ini (normal).</div>` : ''}
        <div class="reasoning-box" style="display:${answered ? 'block' : 'none'}"><b>Alasan:</b> ${esc(page.reasoning || '(tidak ada catatan pada slide ini)')}</div>
      </div>
    </div>
  `;
  setCard(ctx, cardShell(ctx, body));
  wireFooterNav(ctx);

  if (!answered) {
    ctx.document.querySelectorAll<HTMLElement>('#optList .opt-row').forEach((row) => {
      row.onclick = () => {
        // The original recorded only THAT an option was clicked, never which.
        // Rendering is unchanged; the chosen value is captured for telemetry.
        const chosen = row.querySelector('input')?.getAttribute('data-val') ?? '';
        ctx.adapter.emit(
          statement('answered', page.id, {
            result: { response: chosen, success: chosen === page.correct },
          }),
        );
        ctx.state.gradingAnswered[page.id] = true;
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
