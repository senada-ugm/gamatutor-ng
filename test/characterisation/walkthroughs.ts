import type { Step } from './harness.js';

/**
 * The navigation spine of the DRIVE course, derived by walking the frozen
 * fixture (see the plan, Task 2/13). 62 clicks from the hero to the completion
 * screen, including the interactions that gate progress: one option per
 * image-grading page and an answer + submit per quiz page.
 *
 * Regenerate rather than hand-edit if the course content ever changes.
 */
const NAV: Step[] = [
  { click: '#launchBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#optList .opt-row:first-child' },
  { click: '#nextBtn' },
  { click: '#optList .opt-row:first-child' },
  { click: '#nextBtn' },
  { click: '#optList .opt-row:first-child' },
  { click: '#nextBtn' },
  { click: '#optList .opt-row:first-child' },
  { click: '#nextBtn' },
  { click: '#optList .opt-row:first-child' },
  { click: '#nextBtn' },
  { click: '#nextBtn' },
  { click: '#quizOptList .opt-row[data-letter="A"]' },
  { click: '#quizSubmitBtn' },
  { click: '#nextBtn' },
  { click: '#quizOptList .opt-row[data-letter="A"]' },
  { click: '#quizSubmitBtn' },
  { click: '#nextBtn' },
  { click: '#quizOptList .opt-row[data-letter="A"]' },
  { click: '#quizSubmitBtn' },
  { click: '#nextBtn' },
  { click: '#quizOptList .opt-row[data-letter="A"]' },
  { click: '#quizSubmitBtn' },
  { click: '#nextBtn' },
  { click: '#quizOptList .opt-row[data-letter="A"]' },
  { click: '#quizSubmitBtn' },
  { click: '#nextBtn' },
];

/** Hotspot page 12 (Anatomi mata) — 17 pins. */
const HOTSPOT_CLICKS: Step[] = [
  { click: '#hotspotStage .hotspot-pin[data-i="0"]' },
  { click: '#hotspotStage .hotspot-pin[data-i="5"]' },
  { click: '#hotspotStage .hotspot-pin[data-i="0"]' },
];

/** Match page 18 — one correct placement, then one incorrect. */
const MATCH_CLICKS: Step[] = [
  { click: '#matchLeft .match-chip[data-id="durasi"]' },
  { click: '#matchRight .match-zone[data-id="durasi"]' },
  { click: '#matchLeft .match-chip[data-id="hipertensi"]' },
  { click: '#matchRight .match-zone[data-id="glikemik"]' },
];

/**
 * Image-grading lesion pins. Page 22 is the normal fundus and carries NO
 * lesions, so pins only exist from page 23 onward — these clicks must land
 * after that page has been answered.
 */
const GRADING_PIN_CLICKS: Step[] = [
  { click: '#fundusStage .pin[data-li="0"]' },
  { click: '#fundusStage .pin[data-li="2"]' },
];

/** Task 6: hero, first content page, first divider, and the nav chrome. */
export const openingWalkthrough: Step[] = NAV.slice(0, 5);

/** Task 7: content pages, including all ten reveal steps on faktor risiko. */
export const contentWalkthrough: Step[] = NAV.slice(0, 19);

/** Task 8: the cards pages in modul1 and modul2. */
export const cardsWalkthrough: Step[] = NAV.slice(0, 22);

/** Task 9: hotspot points, masks and the detail panel. */
export const hotspotWalkthrough: Step[] = [...NAV.slice(0, 20), ...HOTSPOT_CLICKS];

/** Task 10: match, click-to-place path (drag is not available in jsdom). */
export const matchWalkthrough: Step[] = [...NAV.slice(0, 31), ...MATCH_CLICKS];

/** Task 11: image-grading — answer, then reveal lesion pins. */
export const gradingWalkthrough: Step[] = [...NAV.slice(0, 39), ...GRADING_PIN_CLICKS];

/** Task 12: quiz — next is blocked until answered, then the explanation shows. */
export const quizWalkthrough: Step[] = [
  ...NAV.slice(0, 47),
  { click: '#nextBtn' }, // blocked: no answer yet
  { click: '#quizOptList .opt-row[data-letter="C"]' },
  { click: '#quizSubmitBtn' },
  { click: '#nextBtn' },
];

/** Tasks 13-15: the whole course, every interaction, ending at the certificate. */
export const fullWalkthrough: Step[] = [
  ...NAV.slice(0, 20),
  ...HOTSPOT_CLICKS,
  ...NAV.slice(20, 31),
  ...MATCH_CLICKS,
  ...NAV.slice(31, 39),
  ...GRADING_PIN_CLICKS,
  ...NAV.slice(39),
  { setValue: ['#learnerNameInput', 'Dr. Uji Coba'] },
  { click: '#certBtn' },
];
