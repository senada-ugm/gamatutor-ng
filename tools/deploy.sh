#!/usr/bin/env bash
#
# Deploy GamaTutor to the komunitech VPS.
#
#   ./tools/deploy.sh              # build, ship, reload
#   ./tools/deploy.sh --no-build   # ship what is already in out/
#
# What it does, in order: builds every native course under content/, unpacks
# every imported SCORM package under imported/, ships each one to
# /var/www/gamatutor/courses/<id>/, installs the landing page and the nginx
# vhost from deploy/, obtains a certificate on first run, and reloads nginx
# only after `nginx -t` passes.
#
# Each course directory is swapped atomically: the new copy is uploaded
# alongside the live one and moved into place, with the previous copy kept as
# <id>.prev so a bad deploy can be undone by swapping it back.
#
# There is no server-side application yet — slice S0 is static only.
set -euo pipefail

HOST=${GAMATUTOR_HOST:-root@31.97.190.72}
SSH_KEY=${GAMATUTOR_SSH_KEY:-$HOME/id_ed25519}
DOMAIN=${GAMATUTOR_DOMAIN:-gamatutor.komunitech.id}
CERT_EMAIL=${GAMATUTOR_CERT_EMAIL:-gunturbudiherwanto@gmail.com}
WEBROOT=/var/www/gamatutor
REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

cd "$REPO_ROOT"
SSH=(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$HOST")

say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

# ---------------------------------------------------------------- build

if [[ ${1:-} != "--no-build" ]]; then
  say "Building native courses"
  for dir in content/*/; do
    id=$(basename "$dir")
    [[ -f "$dir/course.json" ]] || continue
    pnpm tsx tools/build-standalone.ts "content/$id" "out/$id"
  done

  # Imported packages are build outputs of other tools. They are unpacked
  # verbatim — never rewritten — so the hosted copy is byte-for-byte what the
  # authoring tool emitted and can be diffed against it.
  say "Unpacking imported packages"
  for dir in imported/*/; do
    id=$(basename "$dir")
    [[ -f "$dir/package.zip" ]] || continue
    rm -rf "out/$id"
    mkdir -p "out/$id"
    unzip -q "$dir/package.zip" -d "out/$id"
    echo "  $id  <- $(basename "$dir")package.zip"
  done
fi

COURSES=()
for dir in out/*/; do
  [[ -f "$dir/index.html" ]] && COURSES+=("$(basename "$dir")")
done
if [[ ${#COURSES[@]} -eq 0 ]]; then
  echo "deploy: nothing built in out/ — run without --no-build" >&2
  exit 1
fi
say "Deploying ${#COURSES[@]} course(s): ${COURSES[*]}"

# ---------------------------------------------------------------- webroot

"${SSH[@]}" "mkdir -p $WEBROOT/courses /var/www/certbot"

# ---------------------------------------------------------------- courses

for id in "${COURSES[@]}"; do
  say "Shipping $id"
  # tar over ssh: no rsync on a Git Bash host, and scp -r is slow for
  # many small files.
  tar -czf - -C out "$id" | "${SSH[@]}" "
    set -e
    rm -rf $WEBROOT/courses/$id.new
    mkdir -p $WEBROOT/courses/$id.new
    tar -xzf - -C $WEBROOT/courses/$id.new --strip-components=1
    rm -rf $WEBROOT/courses/$id.prev
    if [ -d $WEBROOT/courses/$id ]; then mv $WEBROOT/courses/$id $WEBROOT/courses/$id.prev; fi
    mv $WEBROOT/courses/$id.new $WEBROOT/courses/$id
  "
done

# ---------------------------------------------------------------- landing

say "Installing landing page"
"${SSH[@]}" "cat > $WEBROOT/index.html" < deploy/landing/index.html

"${SSH[@]}" "chown -R www-data:www-data $WEBROOT && find $WEBROOT -type d -exec chmod 755 {} + && find $WEBROOT -type f -exec chmod 644 {} +"

# ---------------------------------------------------------------- tls

say "Checking certificate"
HAS_CERT=$("${SSH[@]}" "test -d /etc/letsencrypt/live/$DOMAIN && echo yes || echo no")

if [[ $HAS_CERT == no ]]; then
  say "No certificate yet — serving HTTP only so certbot can validate"
  # A vhost referencing a certificate that does not exist stops nginx from
  # starting, which would take every other site on this box down with it.
  "${SSH[@]}" "cat > /etc/nginx/sites-available/$DOMAIN" <<HTTPONLY
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    location ^~ /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { root $WEBROOT; try_files \$uri \$uri/ =404; }
}
HTTPONLY
  "${SSH[@]}" "ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN && nginx -t && systemctl reload nginx"

  say "Requesting certificate"
  "${SSH[@]}" "certbot certonly --webroot -w /var/www/certbot -d $DOMAIN \
      --non-interactive --agree-tos -m $CERT_EMAIL"
fi

# ---------------------------------------------------------------- vhost

say "Installing vhost"
"${SSH[@]}" "cat > /etc/nginx/sites-available/$DOMAIN" < "deploy/nginx/$DOMAIN.conf"
"${SSH[@]}" "ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN"

say "Testing nginx config"
if ! "${SSH[@]}" "nginx -t"; then
  echo "deploy: nginx config test FAILED — not reloading, existing sites untouched" >&2
  exit 1
fi
"${SSH[@]}" "systemctl reload nginx"

# ---------------------------------------------------------------- verify

say "Verifying"
for id in "${COURSES[@]}"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/courses/$id/")
  echo "  /courses/$id/  -> $code"
done
echo "  /              -> $(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/")"

say "Deployed to https://$DOMAIN"
