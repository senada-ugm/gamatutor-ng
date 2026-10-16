#!/usr/bin/env bash
#
# Deploy compose.prod.yaml (api + app + postgres + redis + rustfs) to the
# shared komunitech VPS behind gamatutor.komunitech.id.
#
#   ./scripts/deploy-vps.sh        # ship HEAD, build on the server, up, reload nginx
#
# Idempotent. The first run also:
#   - writes /etc/gamatutor/ng.env (0600) with generated secrets;
#   - seeds the database (apps/api/src/db/seed.ts: DRIVE course + demo data),
#     replaces the seed accounts' public dev password with generated ones
#     (saved in /etc/gamatutor/ng-accounts.txt, 0600) and unpublishes the
#     seed's non-DRIVE demo courses.
#
# Releases live in /opt/gamatutor-ng/releases/<commit>; /opt/gamatutor-ng/current
# points at the live one. Compose state (volumes lms_postgres_data,
# lms_rustfs_data) is independent of the release directory.
set -euo pipefail

HOST=${GAMATUTOR_HOST:-root@31.97.190.72}
SSH_KEY=${GAMATUTOR_SSH_KEY:-$HOME/id_ed25519}
DOMAIN=${GAMATUTOR_DOMAIN:-gamatutor.komunitech.id}
REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$REPO_ROOT"

SSH=(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$HOST")
say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

if [[ -n $(git status --porcelain) ]]; then
  echo "deploy-vps: the working tree has uncommitted changes; commit first so the release is reproducible" >&2
  exit 1
fi
REV=$(git rev-parse --short=12 HEAD)
RELEASE=/opt/gamatutor-ng/releases/$REV

say "Provisioning (idempotent)"
"${SSH[@]}" DOMAIN="$DOMAIN" bash -s <<'PROVISION'
set -euo pipefail
install -d -m 755 /opt/gamatutor-ng /opt/gamatutor-ng/releases
install -d -m 750 /etc/gamatutor
if [ ! -f /etc/gamatutor/ng.env ]; then
  rnd() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
  cat > /etc/gamatutor/ng.env <<ENV
# Read by docker compose (--env-file) for compose.prod.yaml + deploy/compose.vps.yaml.
PUBLIC_ORIGIN=https://${DOMAIN}
POSTGRES_USER=lms
POSTGRES_PASSWORD=$(rnd 32)
POSTGRES_DB=lms
S3_BUCKET=lms-uploads
S3_ACCESS_KEY=$(rnd 20)
S3_SECRET_KEY=$(rnd 40)
BETTER_AUTH_SECRET=$(rnd 48)
BETTER_AUTH_URL=https://${DOMAIN}
CORS_ORIGIN=https://${DOMAIN}
PII_ENCRYPTION_KEY=$(rnd 32)
AUTO_MIGRATE=true
DEV_MODE=false
# No relay yet: mail goes to the mailpit container. For real delivery set
# SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_SECURE, or clear SMTP_HOST
# and set RESEND_API_KEY, then rerun the deploy.
SMTP_HOST=mailpit
# Quote values with spaces or < >: bash sources this file too.
RESEND_FROM_EMAIL="GamaTutor <no-reply@komunitech.id>"
ENV
  chmod 600 /etc/gamatutor/ng.env
  echo "wrote /etc/gamatutor/ng.env"
fi
PROVISION

say "Shipping $REV"
git archive --format=tar HEAD | gzip | "${SSH[@]}" "
  set -e
  rm -rf $RELEASE.tmp && mkdir -p $RELEASE.tmp
  tar -xzf - -C $RELEASE.tmp
  # Vite bakes the API origin in at build time; same origin as the SPA.
  printf 'VITE_API_URL=https://%s\nVITE_DEV_MODE=false\nVITE_WEB_ORIGIN=https://%s\n' '$DOMAIN' '$DOMAIN' \
    > $RELEASE.tmp/apps/app/.env.production.local
  rm -rf $RELEASE && mv $RELEASE.tmp $RELEASE
"

say "Building images and starting the stack"
"${SSH[@]}" bash -s <<BUILD
set -euo pipefail
cd $RELEASE
dc() { docker compose -p gamatutor --env-file /etc/gamatutor/ng.env -f compose.prod.yaml -f deploy/compose.vps.yaml "\$@"; }
dc build 2>&1 | tail -15
dc up -d --remove-orphans 2>&1 | tail -15
for i in \$(seq 1 60); do
  curl -fsS http://127.0.0.1:8120/health >/dev/null 2>&1 && curl -fsS http://127.0.0.1:3120/ >/dev/null 2>&1 && break
  sleep 2
done
curl -fsS http://127.0.0.1:8120/health; echo
curl -fsS -o /dev/null -w 'app %{http_code}\n' http://127.0.0.1:3120/
BUILD

say "Bucket, first-run seed"
"${SSH[@]}" bash -s <<SEED
set -euo pipefail
cd $RELEASE
set -a; . /etc/gamatutor/ng.env; set +a
docker build -q --target builder -f apps/api/Dockerfile -t gamatutor-api-builder . >/dev/null
tool() {
  docker run --rm -i --network gamatutor_lms-network -w /app/apps/api \
    -e NODE_ENV=production \
    -e DATABASE_URL="postgresql://\$POSTGRES_USER:\$POSTGRES_PASSWORD@postgres:5432/\$POSTGRES_DB" \
    -e BETTER_AUTH_SECRET="\$BETTER_AUTH_SECRET" -e BETTER_AUTH_URL="\$BETTER_AUTH_URL" \
    -e PII_ENCRYPTION_KEY="\$PII_ENCRYPTION_KEY" -e SMTP_HOST=mailpit -e RATE_LIMIT_ENABLED=false \
    -e S3_ENDPOINT=http://rustfs:9000 -e S3_BUCKET="\$S3_BUCKET" \
    -e S3_ACCESS_KEY_ID="\$S3_ACCESS_KEY" -e S3_SECRET_ACCESS_KEY="\$S3_SECRET_KEY" \
    gamatutor-api-builder "\$@"
}

# The api never creates its bucket.
tool node --input-type=module - <<'JS'
import { S3Client, HeadBucketCommand, CreateBucketCommand } from "@aws-sdk/client-s3"
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT, region: "us-east-1", forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
})
const Bucket = process.env.S3_BUCKET
try { await s3.send(new HeadBucketCommand({ Bucket })); console.log("bucket", Bucket, "exists") }
catch { await s3.send(new CreateBucketCommand({ Bucket })); console.log("bucket", Bucket, "created") }
JS

if [ ! -f /etc/gamatutor/ng-accounts.txt ]; then
  tool node_modules/.bin/tsx src/db/seed.ts
  tool node --input-type=module - > /etc/gamatutor/ng-accounts.txt <<'JS'
import pg from "pg"
import { randomBytes } from "node:crypto"
import { hashPassword } from "better-auth/crypto"
const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
await db.connect()
const out = ["GamaTutor seed accounts — https://$DOMAIN/login", ""]
for (const email of ["admin@lms.dev", "owner@lms.dev", "user@lms.dev"]) {
  const pass = randomBytes(15).toString("base64url")
  const res = await db.query(
    "update accounts set password = \$1 where provider_id = 'credential' and user_id = (select id from users where email = \$2)",
    [await hashPassword(pass), email])
  if (res.rowCount !== 1) throw new Error("no credential account for " + email)
  out.push(email + "  " + pass)
}
const demo = await db.query("update courses set status = 'draft' where status = 'published' and slug is distinct from 'drive-retinopati' returning title")
out.push("", "unpublished seed demo courses: " + demo.rows.map((r) => r.title).join("; "))
// Older seeds left DRIVE a draft; publish it through the api so its checks run.
const { rows: [drive] } = await db.query("select id, status from courses where slug = 'drive-retinopati'")
if (drive.status !== "published") {
const origin = "https://$DOMAIN"
const adminPass = out.find((l) => l.startsWith("admin@lms.dev  ")).split("  ")[1]
const signIn = await fetch("http://api:8000/api/auth/sign-in/email", {
  method: "POST", headers: { "Content-Type": "application/json", Origin: origin },
  body: JSON.stringify({ email: "admin@lms.dev", password: adminPass }),
})
const cookie = signIn.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ")
const pub = await fetch("http://api:8000/v1/courses/" + drive.id + "/publish", { method: "POST", headers: { Origin: origin, Cookie: cookie } })
if (!pub.ok) throw new Error("publishing DRIVE failed: " + pub.status)
}
out.push("DRIVE published (" + drive.id + ")")
console.log(out.join("\n"))
await db.end()
JS
  chmod 600 /etc/gamatutor/ng-accounts.txt
  cat /etc/gamatutor/ng-accounts.txt | sed 's/  .*/  (password saved)/'
else
  echo "already seeded (/etc/gamatutor/ng-accounts.txt exists)"
fi
SEED

say "nginx vhost"
"${SSH[@]}" "cat > /etc/nginx/snippets/gamatutor-proxy.conf" < deploy/nginx/gamatutor-proxy.conf
"${SSH[@]}" "cat > /etc/nginx/sites-available/$DOMAIN.new" < deploy/nginx/$DOMAIN.conf
"${SSH[@]}" bash -s <<NGINX
set -euo pipefail
cd /etc/nginx/sites-available
cp -a $DOMAIN $DOMAIN.bak 2>/dev/null || true
mv $DOMAIN.new $DOMAIN
ln -sfn /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
if nginx -t 2>&1; then
  systemctl reload nginx
else
  echo "nginx -t failed; restoring the previous vhost" >&2
  [ -f $DOMAIN.bak ] && mv $DOMAIN.bak $DOMAIN
  exit 1
fi
NGINX

say "Switching current -> $REV"
"${SSH[@]}" bash -s <<SWITCH
set -euo pipefail
ln -sfn $RELEASE /opt/gamatutor-ng/current
# The previous platform (Next.js apps/web + gamatutor-db) is retired, not
# deleted: its service and database container stay on disk for rollback.
if systemctl is-active --quiet gamatutor-web 2>/dev/null; then
  systemctl disable --now gamatutor-web
  docker stop gamatutor-db >/dev/null
  echo "stopped legacy gamatutor-web and gamatutor-db"
fi
cd /opt/gamatutor-ng/releases && ls -1t | tail -n +4 | xargs -r rm -rf
docker image prune -f >/dev/null
SWITCH

say "Smoke test"
# Status codes via printf: Git Bash mangles a newline escape in curl's -w.
for path in / /login /health /v1/courses; do
  printf '%-12s %s\n' "$path" "$(curl -sS -o /dev/null -w '%{http_code}' "https://$DOMAIN$path")"
done
