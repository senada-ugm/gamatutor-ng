"""End-to-end check of the platform against a running server.

    python apps/web/test/e2e.py http://localhost:3100 <server-log-file> [shots-dir]

Registers a learner, follows the verification link from the server log (the
log mailer prints it), takes the DRIVE course to the end, checks the
certificate carries the registered name, then checks the admin report and
CSV export. Exits non-zero on the first failure.
"""

import json
from urllib.parse import quote
import re
import sys
import time
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

BASE = sys.argv[1].rstrip('/')
LOG = Path(sys.argv[2])
SHOTS = Path(sys.argv[3]) if len(sys.argv) > 3 else None
ROOT = Path(__file__).resolve().parents[3]
COURSE = json.loads((ROOT / 'content/drive-retinopati/course.json').read_text(encoding='utf8'))
ANSWERS = [p['correct'] for m in COURSE['modules'] for p in m['pages'] if p['type'] == 'quiz']
STAMP = str(int(time.time()))
EMAIL = f'e2e{STAMP}@example.id'
NAME = 'dr. Uji Coba Peserta, Sp.M'
PASSWORD = 'kata-sandi-uji-123'


def shot(page, name):
    if SHOTS:
        SHOTS.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(SHOTS / f'{name}.png'), full_page=True)


def verification_link() -> str:
    for _ in range(50):
        links = re.findall(r'https?://\S+/verifikasi\?token=\S+', LOG.read_text(encoding='utf8', errors='ignore'))
        mine = [l for l in links]
        if mine:
            return mine[-1]
        time.sleep(0.2)
    raise SystemExit('no verification link in the server log')


def register(page):
    page.goto(f'{BASE}/daftar')
    page.fill('#f-fullName', NAME)
    page.fill('#f-birthDate', '1988-03-09')
    page.fill('#f-phone', '0812 3456 7890')
    page.select_option('#f-profession', 'Dokter spesialis')
    page.fill('#f-institution', 'RS Mata Uji')
    page.select_option('#f-province', 'DI Yogyakarta')
    page.fill('#f-city', 'Sleman')
    page.fill('#f-email', EMAIL)
    page.fill('#f-password', PASSWORD)
    page.fill('#f-passwordConfirm', 'beda')
    page.check('input[name=consent]')
    page.click('button[type=submit]')
    expect(page.locator('#f-passwordConfirm-err')).to_contain_text('tidak sama')
    # Values typed before the error survive the round trip.
    expect(page.locator('#f-fullName')).to_have_value(NAME)
    page.fill('#f-password', PASSWORD)
    page.fill('#f-passwordConfirm', PASSWORD)
    page.check('input[name=consent]')
    page.click('button[type=submit]')
    expect(page.locator('.notice.ok')).to_contain_text(EMAIL)
    shot(page, '01-registered')


def login(page, email, password, then='/kursus'):
    page.goto(f'{BASE}/masuk?lanjut={then}')
    page.fill('#f-email', email)
    page.fill('#f-password', password)
    page.click('button[type=submit]')
    page.wait_for_url(lambda u: u.split('?')[0].endswith(then) and '/masuk' not in u)


def take_course(page):
    page.goto(f'{BASE}/kursus')
    expect(page.locator('.topic h2')).to_contain_text('Retina')
    shot(page, '02-catalogue')
    page.click('text=Lihat kursus')
    page.click('button:has-text("Mulai kursus")')
    page.wait_for_url('**/belajar/drive-retinopati')
    page.evaluate("() => localStorage.setItem('gamatutor.autoNarration', '0')")
    page.reload()
    page.click('#launchBtn')
    q = 0
    for _ in range(300):
        if page.locator('.done-screen').count():
            break
        if page.locator('#quizSubmitBtn:not([disabled])').count():
            page.click(f'#quizOptList .opt-row[data-letter="{ANSWERS[q]}"]')
            page.click('#quizSubmitBtn')
            q += 1
        if page.locator('#optList .opt-row:not(.disabled)').count():
            page.locator('#optList .opt-row').first.click()
        imgs = page.locator('#contentCard img')
        for i in range(imgs.count()):
            ok = imgs.nth(i).evaluate('i => i.complete ? i.naturalWidth > 0 : true')
            if not ok:
                raise SystemExit(f'image did not load: {imgs.nth(i).get_attribute("src")}')
        page.click('#nextBtn')
    expect(page.locator('.pass-badge')).to_contain_text('Lulus')
    shot(page, '03-done')
    # The state is saved: a reload comes back to the completion screen.
    page.wait_for_timeout(2500)
    page.reload()
    expect(page.locator('.done-screen')).to_be_visible()
    page.click('#satisfiedBtn')
    expect(page.locator('.done-note')).to_contain_text(NAME)
    page.click('#certBtn')
    page.wait_for_url('**/sertifikat/**')
    expect(page.locator('.cert-name')).to_have_text(NAME)
    shot(page, '04-certificate')
    serial = page.url.rsplit('/', 1)[-1]
    page.goto(f'{BASE}/verify/{serial}')
    expect(page.locator('.notice.ok')).to_contain_text('sah')
    return serial


def admin_report(page):
    login(page, 'admin@drive.local', 'admin-lokal-123456', '/admin')
    page.click('a:has-text("Laporan")')
    row = page.locator('tr', has_text=EMAIL)
    expect(row).to_contain_text('Dokter spesialis')
    expect(row).to_contain_text('Bersertifikat')
    shot(page, '05-admin')
    with page.expect_download() as dl:
        page.click('text=semua aktivitas (timestamp)')
    text = Path(dl.value.path()).read_text(encoding='utf-8-sig')
    assert text.startswith('waktu_wib,'), text[:80]
    assert EMAIL in text and 'experienced' in text, 'events CSV is missing this learner'


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        learner = browser.new_context(viewport={'width': 1366, 'height': 768})
        page = learner.new_page()
        register(page)
        page.goto(verification_link())
        page.wait_for_url('**/masuk?verified=1')
        login(page, EMAIL, PASSWORD)
        serial = take_course(page)
        admin = browser.new_context(viewport={'width': 1366, 'height': 900}, accept_downloads=True)
        admin_report(admin.new_page())
        browser.close()
    print(f'e2e ok: {EMAIL} certified as {serial}')


if __name__ == '__main__':
    main()
