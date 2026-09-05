import type { PageOfType } from '@gamatutor/course-schema';
import { statement } from '@gamatutor/tracking';
import type { RenderContext } from '../context.js';
import { cardShell, setCard, wireFooterNav } from '../chrome/shell.js';
import { esc, kickerHtml } from '../dom.js';
import { speakText } from '../narration.js';

export function renderHotspot(ctx: RenderContext, page: PageOfType<'hotspot'>): void {
  const { state } = ctx;
  if (!state.hotspotVisited[page.id]) {
    state.hotspotVisited[page.id] = page.points.map(() => false);
  }
  const visited = state.hotspotVisited[page.id]!;
  const activeIdx = state.hotspotActive[page.id];

  const masksHtml = (page.masks || [])
    .map(
      (m) =>
        `<div class="hotspot-mask" style="left:${m.x}%;top:${m.y}%;width:${m.w}%;height:${m.h}%"></div>`,
    )
    .join('');

  const pinsHtml = page.points
    .map((p, i) => {
      let cls = 'hotspot-pin';
      if (visited[i]) cls += ' visited';
      if (activeIdx === i) cls += ' active';
      return `<div class="${cls}" data-i="${i}" style="left:${p.x}%;top:${p.y}%">${i + 1}</div>`;
    })
    .join('');

  const doneCount = visited.filter(Boolean).length;
  const total = page.points.length;

  let detailHtml: string;
  if (activeIdx !== undefined && activeIdx !== null) {
    const p = page.points[activeIdx]!;
    detailHtml = `<div class="hotspot-detail-head"><h3>${esc(p.label)}</h3><button class="mini-speak-btn" id="hotspotSpeakBtn" title="Dengarkan lagi">🔊</button></div><p>${esc(p.body)}</p>`;
  } else {
    detailHtml = `<p class="placeholder">Klik salah satu titik pada gambar untuk melihat penjelasannya.</p>`;
  }

  const body = `
    ${kickerHtml(page)}
    <h2>${esc(page.title)}</h2>
    <div class="title-underline"></div>
    ${page.intro ? `<p style="font-size:14px;color:#334;margin:0 0 14px;line-height:1.6;">${esc(page.intro)}</p>` : ''}
    <div class="hotspot-layout">
      <div class="hotspot-stage" id="hotspotStage">
        <img src="${page.image}" alt="Ilustrasi slide ${page.slide}">
        ${masksHtml}
        ${pinsHtml}
      </div>
      <div class="hotspot-progress">Bagian dijelajahi: ${doneCount}/${total}</div>
      <div class="hotspot-detail" id="hotspotDetail">${detailHtml}</div>
    </div>
  `;
  setCard(ctx, cardShell(ctx, body));
  wireFooterNav(ctx);

  const speakBtn = ctx.document.getElementById('hotspotSpeakBtn');
  if (speakBtn) {
    speakBtn.onclick = () => {
      const p = page.points[activeIdx as number]!;
      speakText(ctx, p.label + '. ' + p.body);
    };
  }

  ctx.document.querySelectorAll<HTMLElement>('#hotspotStage .hotspot-pin').forEach((pinEl) => {
    pinEl.onclick = () => {
      const i = parseInt(pinEl.dataset['i']!, 10);
      visited[i] = true;
      state.hotspotActive[page.id] = i;
      const point = page.points[i]!;
      // Per-point discovery telemetry — the thing SCORM throws away.
      ctx.adapter.emit(
        statement('interacted', page.id, { context: { pointIndex: i, label: point.label } }),
      );
      speakText(ctx, point.label + '. ' + point.body);
      ctx.rerender();
    };
  });
}
