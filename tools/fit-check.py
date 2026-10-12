"""Walks the built course and checks that no page needs scrolling on a laptop.

Usage:  python tools/fit-check.py [out/drive-retinopati] [screenshot-dir]

Opens the standalone build in headless Chromium at 1366x768 and 1920x1080,
clicks through every page (revealing all steps, answering grading and quiz
pages, opening a hotspot point, so each page is measured at its tallest),
and fails if `.card-body` overflows anywhere. A 390x844 phone pass is taken
for screenshots only: phones are allowed to scroll. Needs `pip install
playwright` and `playwright install chromium`.
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else 'out/drive-retinopati').resolve()
SHOTS = Path(sys.argv[2]) if len(sys.argv) > 2 else None
VIEWPORTS = [(1366, 768, True), (1920, 1080, True), (390, 844, False)]


def overflow(page) -> int:
    return page.evaluate(
        """() => { const b = document.querySelector('.card-body');
                   return b ? b.scrollHeight - b.clientHeight : 0; }"""
    )


def settle(page) -> None:
    """Brings the current page to its tallest state."""
    for _ in range(30):
        if page.locator('.anim-step.anim-pending').count() == 0:
            break
        page.click('#nextBtn')
    if page.locator('#quizSubmitBtn:not([disabled])').count():
        page.locator('#quizOptList .opt-row').first.click()
        page.click('#quizSubmitBtn')
    if page.locator('#optList .opt-row:not(.disabled)').count():
        page.locator('#optList .opt-row').first.click()
    for i in range(page.locator('#fundusStage .pin').count()):
        page.evaluate(f"() => document.querySelectorAll('#fundusStage .pin')[{i}].click()")
    if page.locator('.hotspot-pin').count():
        # The longest explanation is the worst case for height.
        page.evaluate(
            """() => { const pins = [...document.querySelectorAll('.hotspot-pin')];
                       pins.forEach(p => p.click()); }"""
        )
    page.wait_for_timeout(120)


def walk(page, w: int, h: int, strict: bool) -> list[str]:
    failures = []
    page.goto(OUT.joinpath('index.html').as_uri())
    page.evaluate("() => { try { localStorage.setItem('gamatutor.autoNarration', '0'); } catch (e) {} }")
    page.reload()
    page.click('#launchBtn')
    seen = set()
    for _ in range(200):
        label = page.locator('.page-indicator').first.text_content() if page.locator('.page-indicator').count() else 'done'
        settle(page)
        over = overflow(page)
        tag = f'{w}x{h} page {label}'
        if strict and over > 1:
            failures.append(f'{tag}: overflows by {over}px')
        if SHOTS:
            SHOTS.mkdir(parents=True, exist_ok=True)
            name = label.replace(' / ', '-of-').replace(' ', '')
            page.screenshot(path=str(SHOTS / f'{w}x{h}-{name}.png'))
        if page.locator('.done-screen').count():
            if page.locator('#satisfiedBtn').count():
                page.click('#satisfiedBtn')
                if strict and overflow(page) > 1:
                    failures.append(f'{tag} (satisfied): overflows by {overflow(page)}px')
                if SHOTS:
                    page.screenshot(path=str(SHOTS / f'{w}x{h}-done-satisfied.png'))
            break
        if label in seen:
            failures.append(f'{tag}: navigation stuck')
            break
        seen.add(label)
        page.click('#nextBtn')
    return failures


def main() -> int:
    failures = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for w, h, strict in VIEWPORTS:
            ctx = browser.new_context(viewport={'width': w, 'height': h})
            failures += walk(ctx.new_page(), w, h, strict)
            ctx.close()
        browser.close()
    for f in failures:
        print('FAIL', f)
    print('fit-check:', 'ok' if not failures else f'{len(failures)} failure(s)')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
