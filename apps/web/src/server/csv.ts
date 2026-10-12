/** RFC 4180 field; also defuses spreadsheet formulas (=, +, -, @ at the start). */
export function csvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** With a BOM, so Excel opens Indonesian text as UTF-8. */
export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header, ...rows].map((r) => r.map(csvField).join(','));
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
