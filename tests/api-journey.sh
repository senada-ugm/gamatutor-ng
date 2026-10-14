#!/usr/bin/env bash
# API journey tests (pure HTTP, no browser): personas x scenarios x
# full contract coverage. Prereqs: dev stack running + seeded DB.
#
#   bash tests/api-journey.sh
set -euo pipefail
cd "$(dirname "$0")/.."
exec node tests/api/run.mjs "$@"
