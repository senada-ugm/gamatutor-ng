# apps/api — operational notes

## Backups

`pnpm --filter api db:backup` writes a timestamped custom-format dump to
`apps/api/backups/` (gitignored) and prints the restore command:

```
pg_restore --clean --if-exists -d "$DATABASE_URL" apps/api/backups/lms-<stamp>.dump
```

- The local `pg_dump` client must be the same (or newer) major version as
  the server — a mismatch aborts. The script then looks for a running
  postgres container and prints the `docker exec … pg_dump` that matches.
- Schedule externally (cron / Task Scheduler); the script is the
  single-run primitive, not a scheduler. Keep the dump directory on
  storage that is itself backed up.

## Metrics (Prometheus)

`GET /metrics` exposes Node defaults, an `http_request_duration_seconds`
histogram (labels: method/route/status, bounded cardinality — route
patterns, not raw URLs), and `db_pool_*` gauges. It is unauthenticated:
bind the scrape to an internal interface or firewall it.

```yaml
# prometheus.yml scrape fragment
scrape_configs:
  - job_name: lms-api
    scrape_interval: 15s
    metrics_path: /metrics
    static_configs:
      - targets: ["lms-api.internal:8000"]
```

## Rate limiting

In-memory by default (per-instance budgets — correct only for a single
instance). Set `REDIS_URL` to share one budget across every instance
behind a load balancer; see `src/plugins/rate-limit.ts`.

## Payments

Manual-transfer confirmation is the default flow. Set `PAYMENT_SECRET_KEY`
(+ `PAYMENT_WEBHOOK_SECRET`) to enable the Stripe-compatible gateway —
hosted checkout + webhook flip; point the gateway's webhook at
`POST <api>/v1/payments/webhook`. Any processor speaking the Stripe API
works; `PAYMENT_API_BASE` switches endpoints (e.g. stripe-mock in tests).

## PII encryption

Set `PII_ENCRYPTION_KEY` wherever real KTP/BPJS numbers are collected
(see `.env.example` for the full explanation and rotation caveat).
