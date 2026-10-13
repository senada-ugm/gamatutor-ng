# Deployment

**Live: <https://gamatutor.komunitech.id>** — first deployed 2026-09-05; the
platform (accounts, catalogue, reports) since 2026-10-13.

## What is deployed

| URL | Serves |
|---|---|
| `/` | The DRIVE landing page (static), whose buttons lead into the platform |
| `/daftar`, `/masuk`, `/kursus`, `/belajar/…`, `/sertifikat/…`, `/verify/…`, `/admin/…` | The platform: `apps/web`, a Next.js app on 127.0.0.1:3110 behind nginx |
| `/courses/drive-retinopati/` | The DRIVE SCORM build (static): for other LMSs, and as a public preview without tracking or certificates |
| `/courses/dasar-algoritma/` | A SlideForge SCORM package from `imported/`, hosted verbatim |
| `/app/` | The old platform mockup (static) |

### The platform

| | |
|---|---|
| Code | `/opt/gamatutor/releases/<commit>`, live one at `/opt/gamatutor/current` |
| Process | systemd `gamatutor-web` (user `gamatutor`), `deploy/web/gamatutor-web.service` |
| Database | Docker container `gamatutor-db` (postgres:17-alpine), 127.0.0.1:15433, volume `gamatutor-pgdata` |
| Course files | `/var/lib/gamatutor/storage/<course>/v<n>/` (published versions are immutable) |
| Config | `/etc/gamatutor/web.env` (0640) — database URL, base URL, SMTP |
| Admin login | `/etc/gamatutor/admin.txt` (0600), created on first deploy |
| Logs | `journalctl -u gamatutor-web` |

**Email verification is switched off** (`GT_REQUIRE_EMAIL_VERIFICATION=false`)
because no SMTP server is configured. New accounts stay *unverified* meanwhile,
so turning verification on later asks them to confirm their email. Until then a
learner who forgets their password asks an admin, who makes a one-time reset
link from the course report (`Buat tautan reset sandi`).

Because nobody's email is proven meanwhile, **identity is checked by the
organiser instead**: on `/admin/peserta` an admin matches each learner against
Tim DRIVE's own participant list and marks them *terverifikasi*. The public
`/verify/{serial}` page states whether the holder of a certificate was checked. To turn it on, set `SMTP_URL` and
`SMTP_FROM` in `web.env`, delete that line, and `systemctl restart gamatutor-web`.

Publishing a course is part of every deploy and is idempotent: a course whose
`course.json` and assets have not changed keeps its version. To publish by hand:

```bash
cd /opt/gamatutor/current/apps/web
set -a; . /etc/gamatutor/web.env; set +a
runuser -u gamatutor -- ../../node_modules/.bin/tsx scripts/publish-course.ts ../../content/<dir> --topic retina
```

## Host

| | |
|---|---|
| Server | `root@31.97.190.72` (Ubuntu 24.04.4 LTS) |
| Access | SSH key at `~/id_ed25519`, passwordless — see `vps-rpld.txt` |
| Web server | nginx 1.24.0, systemd |
| Webroot | `/var/www/gamatutor` |
| TLS | Let's Encrypt via certbot 2.9.0, auto-renewing (`certbot.timer` active) |
| Certificate | Issued 2026-09-05, expires 2026-12-04 |
| Logs | `/var/log/nginx/gamatutor.{access,error}.log` |

**This box is shared.** It also hosts `slideforge`, `cpp`, `meet`, `oba`,
`vote`, `pdf`, `pantau` and `simpbb` under `komunitech.id`. Anything that takes
nginx down takes all of them with it — which is why the deploy script never
reloads without a passing `nginx -t`.

## Deploying

```bash
./tools/deploy-web.sh          # the platform: ship HEAD, build on the server, switch, restart
./tools/deploy.sh              # static courses, landing page, nginx vhost
```

Run them in that order: the vhost proxies to the app. `deploy-web.sh` refuses
to run with uncommitted changes, builds on the server (Next.js with webpack),
health-checks `/kursus` and rolls back to the previous release on failure. It
keeps the three newest releases.


```bash
./tools/deploy.sh              # build every course, ship, reload
./tools/deploy.sh --no-build   # ship whatever is already in out/
```

Overridable via environment: `GAMATUTOR_HOST`, `GAMATUTOR_SSH_KEY`,
`GAMATUTOR_DOMAIN`, `GAMATUTOR_CERT_EMAIL`.

The script builds each native course under `content/`, unpacks each SCORM
package under `imported/`, ships them with `tar` over ssh
(the dev host is Git Bash on Windows, which has no `rsync`), installs the
landing page and the vhost from `deploy/`, obtains a certificate on first run,
then tests and reloads nginx.

### Atomic swaps and rollback

Each course is uploaded beside the live copy and moved into place, so a visitor
never sees a half-written directory. The previous copy is kept:

```
/var/www/gamatutor/courses/drive-retinopati        # live
/var/www/gamatutor/courses/drive-retinopati.prev   # previous deploy
/var/www/gamatutor/courses/dasar-algoritma
/var/www/gamatutor/courses/dasar-algoritma.prev
```

To roll back one course without a rebuild:

```bash
ssh root@31.97.190.72 '
  cd /var/www/gamatutor/courses
  mv drive-retinopati drive-retinopati.bad
  mv drive-retinopati.prev drive-retinopati
'
```

Only one generation is kept. A second deploy overwrites `.prev`, so roll back
before redeploying, not after.

## Configuration lives in the repo

`deploy/nginx/gamatutor.komunitech.id.conf` is authoritative. The deploy script
copies it to `/etc/nginx/sites-available/` and symlinks it into
`sites-enabled/`.

**Do not hand-edit the config on the server** — the next deploy silently
overwrites it. Edit the repo file and redeploy.

**Do not run `certbot --nginx`** for this domain. It rewrites vhosts in place,
which would fight the repo copy. The script uses `certbot certonly --webroot`
against `/var/www/certbot` precisely so the vhost stays ours.

### Notable config decisions

- **No SPA fallback.** A missing file 404s. The player has no client-side
  routing, and a fallback would answer a missing asset with HTML and status
  200 — far harder to debug than a 404.
- **HTML is `no-cache`.** Course pages inline their CSS, the player bundle and
  `course.json`, so the HTML changes on every rebuild.
- **Assets cache for a day.** They are not content-hashed yet. When the
  platform starts hashing asset filenames this can become immutable.
- **`imsmanifest.xml` returns 404.** It is only meaningful inside a downloaded
  SCORM package; serving it here invites confusion about what the URL is.
- **`mp4` directive enabled** so seeking works in the visus video.
- **`listen 443 ssl http2`**, not `http2 on`. This host runs nginx 1.24, which
  predates the separate directive (1.25.1+). Change it when the box is
  upgraded.

## Gotchas hit during the first deploy

**`http2 on;` broke `nginx -t`.** nginx 1.24 does not know the directive. The
script caught it, refused to reload, and left every other site running. Fixed
by using the listen-flag form.

**Pre-existing warnings, not ours.** `nginx -t` emits `protocol options
redefined` for `pantau`, `pdfkerja` and `simpbb-tabanan`. Those vhosts repeat
`http2` on `listen` lines for an address already configured elsewhere. Harmless,
predates this deployment, and worth tidying whenever someone touches those
files.

**Certificate ordering.** A vhost that references a certificate which does not
exist stops nginx from starting — on a shared box that is an outage for
everything. The script therefore installs an HTTP-only vhost first, gets the
certificate, and only then installs the TLS vhost.

## Verifying a deploy

The script checks status codes at the end. **Status codes are not enough for
the imported package**: it is a JavaScript app that `fetch`es `course.json`
after load, so a 200 on `index.html` says nothing about whether it renders.
Open it in a browser and confirm the outline and the quiz appear.

A fuller manual pass:

```bash
D=gamatutor.komunitech.id
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://$D/      # 301 -> https
curl -s https://$D/ | grep -o '<title>[^<]*'                             # landing
curl -s https://$D/courses/drive-retinopati/ | wc -c                     # ~67 kB
curl -s -o /dev/null -w '%{http_code}\n' https://$D/courses/drive-retinopati/assets/visus.mp4
echo | openssl s_client -connect $D:443 -servername $D 2>/dev/null \
  | openssl x509 -noout -subject -enddate
```

And, because the box is shared, confirm the neighbours after any nginx change:

```bash
for d in slideforge cpp meet oba vote pdf pantau simpbb; do
  printf '%-12s %s\n' "$d" "$(curl -s -o /dev/null -w '%{http_code}' https://$d.komunitech.id/)"
done
```

## Known limits

- **No CI.** Deployment is a manual script run from a developer machine.
- **No staging.** The script deploys straight to production.
- **Root SSH.** Deploys run as `root`; a dedicated deploy user owning only
  `/var/www/gamatutor` and a reload sudoers rule would be better.
- **One rollback generation**, and no rollback for the vhost — reverting that
  means checking out the old config and redeploying.
- **The courses are public and unauthenticated.** Anyone with the URL can take
  them, and the quiz answers are in the page source, as they were in the
  original. Real access control and secured grading arrive with slices S2
  and S3.
- **No tracking at all.** Neither course reports anywhere. The native one has
  a SCORM adapter that finds no LMS and no-ops; the imported one shows its own
  "not connected to an LMS" banner. Completion and scores are lost on refresh.
- **The imported package is a build artifact of Aug 2026.** SlideForge could
  not be rebuilt at deploy time — its `node_modules` was incomplete and
  restoring it wanted a full wipe-and-reinstall of that workspace, which was
  out of scope for a GamaTutor deploy. Rebuild it there and replace
  `imported/dasar-algoritma/package.zip` when convenient.
