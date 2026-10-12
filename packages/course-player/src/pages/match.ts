import type { PageOfType } from '@gamatutor/course-schema';
import { statement } from '@gamatutor/tracking';
import type { RenderContext } from '../context.js';
import { cardShell, setCard, wireFooterNav } from '../chrome/shell.js';
import { esc, kickerHtml } from '../dom.js';

/**
 * Fisher-Yates, taking its randomness from the caller so tests can seed it.
 * The consumption order and count must match the original exactly, or seeded
 * sequences diverge and characterisation parity fails.
 */
export function shuffle<T>(arr: readonly T[], random: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

export function renderMatch(ctx: RenderContext, page: PageOfType<'match'>): void {
  const { state } = ctx;
  if (!state.matchState[page.id]) {
    state.matchState[page.id] = {
      leftOrder: shuffle(
        page.pairs.map((p) => p.id),
        ctx.random,
      ),
      rightOrder: shuffle(
        page.pairs.map((p) => p.id),
        ctx.random,
      ),
      matched: {},
      selected: null,
    };
  }
  const ms = state.matchState[page.id]!;
  const byId = new Map(page.pairs.map((p) => [p.id, p]));

  const leftHtml = ms.leftOrder
    .map((id) => {
      const p = byId.get(id)!;
      const isMatched = !!ms.matched[id];
      let cls = 'match-chip';
      if (isMatched) cls += ' matched';
      else if (ms.selected === id) cls += ' selected';
      return `<div class="${cls}" draggable="${!isMatched}" data-id="${id}" tabindex="0" role="button" aria-grabbed="${ms.selected === id}" aria-label="${esc(p.left)}">${esc(p.left)}</div>`;
    })
    .join('');

  const rightHtml = ms.rightOrder
    .map((id) => {
      const p = byId.get(id)!;
      const isMatched = !!ms.matched[id];
      let cls = 'match-zone';
      if (isMatched) cls += ' matched';
      return `<div class="${cls}" data-id="${id}" tabindex="0" role="button" aria-dropeffect="move">${esc(p.right)}</div>`;
    })
    .join('');

  const doneCount = Object.keys(ms.matched).length;
  const total = page.pairs.length;

  const body = `
    ${kickerHtml(page)}
    <h2>${esc(page.title)}</h2>
    <div class="title-underline"></div>
    ${page.intro ? `<p class="page-instruction">${esc(page.intro)}</p>` : ''}
    <div class="match-layout">
      <div class="match-col" id="matchLeft">${leftHtml}</div>
      <div class="match-col" id="matchRight">${rightHtml}</div>
    </div>
    <div class="match-progress">${doneCount === total ? '&#10003; Semua (' + total + '/' + total + ') sudah cocok!' : 'Tercocokkan: ' + doneCount + '/' + total}</div>
  `;
  setCard(ctx, cardShell(ctx, body));
  wireFooterNav(ctx);

  function tryMatch(id: string | null, zoneEl: HTMLElement): void {
    if (!id || ms.matched[id]) return;
    const correct = id === zoneEl.dataset['id'];
    ctx.adapter.emit(
      statement('answered', page.id, {
        result: { response: `${id}->${zoneEl.dataset['id']}`, success: correct },
      }),
    );
    if (correct) {
      ms.matched[id] = true;
      ms.selected = null;
      ctx.rerender();
    } else {
      zoneEl.classList.remove('wrong');
      void zoneEl.offsetWidth;
      zoneEl.classList.add('wrong');
      ctx.window.setTimeout(() => zoneEl.classList.remove('wrong'), 450);
      ms.selected = null;
      ctx.document
        .querySelectorAll('#matchLeft .match-chip.selected')
        .forEach((c) => c.classList.remove('selected'));
    }
  }

  ctx.document.querySelectorAll<HTMLElement>('#matchLeft .match-chip').forEach((chip) => {
    if (chip.classList.contains('matched')) return;
    chip.onclick = () => {
      ms.selected = ms.selected === chip.dataset['id'] ? null : chip.dataset['id']!;
      ctx.rerender();
    };
    chip.onkeydown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      chip.click();
    };
    chip.addEventListener('dragstart', (e) => {
      (e as DragEvent).dataTransfer?.setData('text/plain', chip.dataset['id']!);
    });
  });

  ctx.document.querySelectorAll<HTMLElement>('#matchRight .match-zone').forEach((zone) => {
    if (zone.classList.contains('matched')) return;
    zone.onclick = () => {
      tryMatch(ms.selected, zone);
    };
    zone.onkeydown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      zone.click();
    };
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('over');
    });
    zone.addEventListener('dragleave', () => {
      zone.classList.remove('over');
    });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('over');
      const id = (e as DragEvent).dataTransfer?.getData('text/plain') ?? null;
      tryMatch(id, zone);
    });
  });
}
