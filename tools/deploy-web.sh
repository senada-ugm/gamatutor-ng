#!/usr/bin/env bash
#
# Deploy the GamaTutor platform (apps/web) to the komunitech VPS.
#
#   ./tools/deploy-web.sh          # ship HEAD, build on the server, switch, restart
#
# Run it before tools/deploy.sh, which installs the nginx vhost that proxies
# to the app. Everything here is idempotent; the first run also provisions:
#
#   - a system user `gamatutor` that runs the app;
#   - a Postgres 17 container `gamatutor-db` on 127.0.0.1:15433 with a named
#     volume, as every other app on this shared box has its own database;
#   - /etc/gamatutor/web.env (0600) with a generated database password;
#   - an admin account, its password in /etc/gamatutor/admin.txt (0600).
#
# Releases live in /opt/gamatutor/releases/<commit>; /opt/gamatutor/current
# points at the live one, and the previous release stays for rollback:
#   ln -sfn /opt/gamatutor/releases/<old> /opt/gamatutor/current && systemctl restart gamatutor-web
set -euo pipefail

HOST=${GAMATUTOR_HOST:-root@31.97.190.72}
SSH_KEY=${GAMATUTOR_SSH_KEY:-$HOME/id_ed25519}
DOMAIN=${GAMATUTOR_DOMAIN:-gamatutor.komunitech.id}
ADMIN_EMAIL=${GAMATUTOR_ADMIN_EMAIL:-admin@gamatutor.komunitech.id}
REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$REPO_ROOT"

SSH=(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$HOST")
say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

if [[ -n $(git status --porcelain) ]]; then
  echo "deploy-web: the working tree has uncommitted changes; commit first so the release is reproducible" >&2
  exit 1
fi
REV=$(git rev-parse --short=12 HEAD)
RELEASE=/opt/gamatutor/releases/$REV

say "Provisioning (idempotent)"
"${SSH[@]}" bash -s <<'PROVISION'
set -euo pipefail
id gamatutor >/dev/null 2>&1 || useradd --system --home /var/lib/gamatutor --shell /usr/sbin/nologin gamatutor
install -d -o gamatutor -g gamatutor -m 750 /var/lib/gamatutor /var/lib/gamatutor/storage
install -d -m 755 /opt/gamatutor /opt/gamatutor/releases
install -d -m 750 /etc/gamatutor

if [ ! -f /etc/gamatutor/web.env ]; then
  DBPASS=$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 28)
  cat > /etc/gamatutor/web.env <<ENV
NODE_ENV=production
DATABASE_URL=postgres://gamatutor:${DBPASS}@127.0.0.1:15433/gamatutor
GT_STORAGE_DIR=/var/lib/gamatutor/storage
GT_BASE_URL=https://gamatutor.komunitech.id
# No SMTP server is configured yet. With verification required nobody could
# activate an account, so it is off until SMTP_URL is set; then remove this.
GT_REQUIRE_EMAIL_VERIFICATION=false
# SMTP_URL=smtps://user:pass@smtp.example.com:465
# SMTP_FROM=DRIVE School <no-reply@komunitech.id>
NEXT_TELEMETRY_DISABLED=1
ENV
  chmod 600 /etc/gamatutor/web.env
  chown root:gamatutor /etc/gamatutor/web.env
  chmod 640 /etc/gamatutor/web.env
fi

if ! docker inspect gamatutor-db >/dev/null 2>&1; then
  DBPASS=$(sed -n 's#^DATABASE_URL=postgres://gamatutor:\([^@]*\)@.*#\1#p' /etc/gamatutor/web.env)
  docker run -d --name gamatutor-db --restart unless-stopped \
    -e POSTGRES_USER=gamatutor -e POSTGRES_PASSWORD="$DBPASS" -e POSTGRES_DB=gamatutor \
    -p 127.0.0.1:15433:5432 -v gamatutor-pgdata:/var/lib/postgresql/data \
    --memory 512m postgres:17-alpine >/dev/null
  echo "started gamatutor-db"
fi
for i in $(seq 1 30); do
  docker exec gamatutor-db pg_isready -U gamatutor -d gamatutor >/dev/null 2>&1 && break
  sleep 1
done
docker exec gamatutor-db pg_isready -U gamatutor -d gamatutor
PROVISION

say "Shipping $REV"
git archive --format=tar HEAD | gzip | "${SSH[@]}" "
  set -e
  rm -rf $RELEASE.tmp && mkdir -p $RELEASE.tmp
  tar -xzf - -C $RELEASE.tmp
  rm -rf $RELEASE && mv $RELEASE.tmp $RELEASE
"

say "Installing and building on the server"
"${SSH[@]}" bash -s <<BUILD
set -euo pipefail
cd $RELEASE
export NEXT_TELEMETRY_DISABLED=1 CI=1
npx --yes pnpm@10.14.0 install --frozen-lockfile --reporter=append-only 2>&1 | tail -5
cd apps/web
npx --yes pnpm@10.14.0 run build 2>&1 | tail -25
chown -R gamatutor:gamatutor $RELEASE/apps/web/.next
BUILD

say "Migrating, publishing courses, ensuring an admin"
"${SSH[@]}" bash -s <<PUBLISH
set -euo pipefail
cd $RELEASE/apps/web
set -a; . /etc/gamatutor/web.env; set +a
run() { runuser -u gamatutor -- env \$(grep -v '^#' /etc/gamatutor/web.env | xargs) "\$@"; }
run ../../node_modules/.bin/tsx scripts/publish-course.ts ../../content/drive-retinopati \
  --topic retina --topic-title Retina \
  --summary "Skrining retinopati diabetika untuk dokter layanan primer: diabetes mellitus, retinopati diabetika, skrining dan tatalaksana, serta simulasi grading foto fundus."
if [ ! -f /etc/gamatutor/admin.txt ]; then
  PASS=\$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 20)
  GT_ADMIN_PASSWORD=\$PASS run ../../node_modules/.bin/tsx scripts/create-admin.ts "$ADMIN_EMAIL" "Admin DRIVE"
  printf 'GamaTutor admin\nURL: https://$DOMAIN/admin\nEmail: %s\nPassword: %s\n' "$ADMIN_EMAIL" "\$PASS" > /etc/gamatutor/admin.txt
  chmod 600 /etc/gamatutor/admin.txt
fi
PUBLISH

say "Switching to $REV and restarting"
"${SSH[@]}" "cat > /etc/systemd/system/gamatutor-web.service" < deploy/web/gamatutor-web.service
"${SSH[@]}" bash -s <<SWITCH
set -euo pipefail
PREV=\$(readlink -f /opt/gamatutor/current 2>/dev/null || true)
ln -sfn $RELEASE /opt/gamatutor/current
systemctl daemon-reload
systemctl enable gamatutor-web >/dev/null 2>&1
systemctl restart gamatutor-web
for i in \$(seq 1 30); do
  code=\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3110/kursus || true)
  [ "\$code" = 200 ] && break
  sleep 1
done
if [ "\$code" != 200 ]; then
  echo "health check failed (\$code); rolling back to \$PREV" >&2
  journalctl -u gamatutor-web -n 40 --no-pager >&2
  if [ -n "\$PREV" ] && [ "\$PREV" != "$RELEASE" ]; then
    ln -sfn "\$PREV" /opt/gamatutor/current && systemctl restart gamatutor-web
  fi
  exit 1
fi
echo "app healthy on 127.0.0.1:3110"
# Keep the three newest releases.
ls -1dt /opt/gamatutor/releases/*/ | tail -n +4 | xargs -r rm -rf
SWITCH

say "Platform deployed ($REV). Now run tools/deploy.sh to install the vhost."
