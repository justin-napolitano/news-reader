# News Reader Production Runbook

News Reader is a private reader UI backed by Life Graph. The deployed app should treat Life Graph as the source of truth for sources, article state, relevance controls, notes, and deterministic extraction outputs.

## Required Vercel Environment

Set these on the Vercel project:

- `NEWS_READER_ADMIN_USER`: login username, normally `admin`
- `NEWS_READER_ADMIN_PASSCODE`: private reader passcode
- `NEWS_READER_SESSION_SECRET`: long random session signing secret
- `NEWS_READER_COOKIE_SECURE`: `1` in production
- `NEWS_READER_CRON_SECRET`: bearer token used by scheduled imports
- `NEWS_READER_ITEMS_SOURCE`: `life_graph` in production
- `LIFE_GRAPH_API_BASE_URL`: production Life Graph API base URL
- `LIFE_GRAPH_WRITE_TOKEN`: Life Graph write token

Do not commit real values. Use `.env.vercel.production` locally and `npm run vercel:env:plan` before `npm run vercel:env:push`.

## Migrations

Life Graph migrations are applied from the `jnap-life-graph` repo, not from this app. After merging a News Reader change that depends on a new Life Graph migration:

```sh
set -a
. /Users/justin/repos/jnap-life-graph/.env
set +a
PYTHONPATH=/path/to/jnap-life-graph/src uv run --with 'psycopg[binary]>=3.2,<4' \
  python -m life_graph.cli db:migrate --root /path/to/jnap-life-graph
```

Run it twice. The second run should apply nothing and skip every known migration.

## Scheduled Import

`.github/workflows/daily-news-import.yml` triggers `https://news.selectproj.com/api/cron/news-import` every three hours at minute 17 UTC and can be run manually with `workflow_dispatch`.

The endpoint requires:

```http
Authorization: Bearer $NEWS_READER_CRON_SECRET
```

The import is idempotent. The feed import creates stable work IDs and sends an idempotency key to Life Graph.

## Source Management

The admin page can add, edit, remove, and restore RSS sources. Removing a source disables it in Life Graph; it does not delete source history.

Adding a source with the same feed URL as an existing source updates that existing source ID. If the existing source was disabled, saving it again restores it.

## Smoke Checks

Local smoke:

```sh
npm run smoke
```

Production read-only smoke:

```sh
NEWS_READER_BASE_URL=https://news.selectproj.com \
NEWS_READER_ADMIN_USER=admin \
NEWS_READER_ADMIN_PASSCODE=... \
npm run smoke:production
```

Production smoke with an intentional refresh:

```sh
NEWS_READER_SMOKE_REFRESH=1 npm run smoke:production
```

The admin page also exposes a refresh status panel with the latest in-process refresh attempt, source health checks, feed cache metadata, and the configured scheduled-import cadence.
