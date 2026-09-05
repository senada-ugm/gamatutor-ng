import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

describe('frozen legacy fixture', () => {
  it('boots in jsdom and renders the first page', () => {
    const html = readFileSync('fixtures/legacy/index.html', 'utf8');
    const dom = new JSDOM(html, { runScripts: 'dangerously' });
    const card = dom.window.document.getElementById('contentCard');
    expect(card).not.toBeNull();
    expect(card!.innerHTML).toContain('Pelatihan Skrining Retinopati Diabetika');
  });

  it('renders one sidebar entry per module', () => {
    const html = readFileSync('fixtures/legacy/index.html', 'utf8');
    const dom = new JSDOM(html, { runScripts: 'dangerously' });
    const steps = dom.window.document.querySelectorAll('#stepList .step');
    expect(steps.length).toBe(7);
  });
});
