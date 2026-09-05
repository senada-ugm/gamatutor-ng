import type { Page } from '@gamatutor/course-schema';

/**
 * Escapes only `&` and `<`, exactly as the original course did. Widening this
 * would change every rendered page and break characterisation parity — if it
 * ever needs to change, that is a deliberate, re-baselined decision.
 */
export function esc(s: string | undefined | null): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

export function kickerHtml(page: Page): string {
  const kicker = 'kicker' in page ? page.kicker : undefined;
  return kicker ? `<div class="kicker-badge">${esc(kicker)}</div>` : '';
}

/**
 * Turns a plain-text body into paragraphs and lists. Bullets are recognised
 * from a leading •, ·, "a." … "j.", or "1." … "99.". A bare number on its own
 * line is merged with the line beneath it, which is how the source deck's
 * numbered lists survived the PPTX extraction.
 */
export function renderBodyBlock(body: string | undefined): string {
  if (!body) return '';
  let lines = body
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => l.trim());

  const merged: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const nextLine = lines[i + 1];
    if (/^\d{1,2}$/.test(line) && nextLine !== undefined && !/^\d{1,2}$/.test(nextLine)) {
      merged.push(line + '. ' + nextLine);
      i++;
    } else {
      merged.push(line);
    }
  }
  lines = merged;

  let html = '';
  let inList = false;
  lines.forEach((line) => {
    const isBullet =
      /^[•·]\s*/.test(line) || /^[a-j]\.\s+/.test(line) || /^\d{1,2}\.\s+/.test(line);
    const text = line.replace(/^[•·]\s*/, '');
    if (isBullet) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${esc(text)}</li>`;
    } else {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      html += `<p>${esc(line)}</p>`;
    }
  });
  if (inList) html += '</ul>';
  return html;
}
