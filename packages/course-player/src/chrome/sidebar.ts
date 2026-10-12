import type { RenderContext } from '../context.js';

/**
 * Module list. Modules beyond the furthest reached are locked; clicking an
 * unlocked one jumps to its first page.
 */
export function renderSidebar(ctx: RenderContext): void {
  const ul = ctx.document.getElementById('stepList');
  if (!ul) return;
  const { course, state } = ctx;

  ul.innerHTML = course.modules
    .map((m, i) => {
      const locked = i > state.furthestModuleIdx;
      const done = i < state.furthestModuleIdx;
      let cls = 'step';
      if (i === state.moduleIdx) cls += ' active';
      else if (done) cls += ' done';
      else if (locked) cls += ' locked';
      const icon = done ? '✓' : locked ? '\u{1F512}' : '▶';
      return `<li class="${cls}" data-idx="${i}" title="${locked ? 'Selesaikan modul sebelumnya dulu' : ''}">
      <span class="num">${i + 1}</span>
      <span class="play">${icon}</span>
      <span>${m.label}</span>
    </li>`;
    })
    .join('');

  ul.querySelectorAll<HTMLElement>('.step').forEach((el) => {
    const i = parseInt(el.dataset['idx']!, 10);
    if (i > state.furthestModuleIdx) return;
    el.onclick = () => {
      state.moduleIdx = i;
      state.pageIdx = 0;
      ctx.rerender();
    };
  });
}
