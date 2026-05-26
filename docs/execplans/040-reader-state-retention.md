# Reader State And Retention

ID: `ig-040-reader-state-retention`
Status: `implemented`
Scope owner: `news-reader` + `jnap-life-graph`

## Intent

Make the reader behave like an inbox backed by Life Graph:

- unread items are visible by default
- opening an unread item marks it read
- saved items stay available
- dismissed or stale unread items leave the default feed
- retention is dry-run first and owned by Life Graph

## Research Lock

| Claim | Class | References | Why it matters | Implementation consequence |
| --- | --- | --- | --- | --- |
| Reader actions should be modeled as activities, not one-off UI flags. | bibliography_backed | `bib-activitystreams`, `bib-cloudevents`, `local-codex-biblio-execution-observability` | Read/save/dismiss events need replayable provenance for future ranking and agents. | Life Graph stores both current state and `intel_graph.intake_events` rows. |
| Article metadata should remain separate from public Life Graph projections. | bibliography_backed | `bib-schema-creativework`, `bib-prov-dm`, `docs/schema/intel-graph-lifedb.md` | The reader may contain private interests and source history. | Raw reader state lives in private `intel_graph` tables; public surfaces must consume curated projections. |
| Empty inboxes are valid product states. | project_assumption | `docs/project-intent.md` | When every article is read or dismissed, the UI should not refill with raw feed data. | `NEWS_READER_ITEMS_SOURCE=life_graph` accepts empty Life Graph views without feed fallback. |
| Retention must be reversible before destructive pruning exists. | project_assumption | `docs/project-intent.md`, `docs/research/research-quality-gates.md` | Early policy mistakes should not destroy useful reading history. | This node archives stale unread items; it does not delete works, import runs, or full text. |
| API-first repos should expose state transitions through bounded JSON endpoints. | local_artifact_backed | `local-codex-biblio-api-first`, `local-researcher-local-orchestration-api` | Browser UI and future agents need the same mutation boundary. | News Reader calls Life Graph HTTP endpoints and never connects directly to Postgres. |

## Depends On

- `ig-030-life-graph-client-apply`
- Life Graph Intel intake migration/API through `db/migrations/011_intel_graph_intake.sql`

## Scope In

- Add Life Graph reader state tables and default retention policy.
- Create unread, saved, read, archived, and all reader views.
- Record read, save, unsave, dismiss, archive, and restore actions.
- Add dry-run-first retention apply API and CLI commands.
- Make News Reader load Life Graph reader views when `NEWS_READER_ITEMS_SOURCE=life_graph`.
- Add UI controls for reader views and state actions.
- Add docs, scripts, smoke checks, and focused tests.

## Scope Out

- Background scheduler deployment.
- Full-text persistence or deletion.
- Ranking, recommendations, summarization, and annotation UI.
- Multi-user identity beyond `actor_id`.
- MCP server wrappers.

## Contracts

- Life Graph:
  - `GET /api/intel/reader/works?view=unread|saved|read|archived|all`
  - `POST /api/intel/reader/state`
  - `GET /api/intel/retention/policy`
  - `POST /api/intel/retention/apply`
- News Reader:
  - `GET /api/items?view=unread|saved|read|archived`
  - `GET /api/life-graph/intel/reader/works`
  - `POST /api/life-graph/intel/reader/state`
  - `POST /api/life-graph/intel/retention/apply`

## Mutation Policy

Local News Reader endpoints do not mutate storage directly. They proxy authenticated Life Graph calls.

Life Graph mutations are limited to:

- `intel_graph.work_user_state`
- `intel_graph.intake_events`
- `life_graph_events`

Retention apply archives stale unread state rows. It does not delete source rows, work rows, import runs, graph patches, or
article text.

## Idempotency

- Feed imports are still idempotent through `life_graph_import.idempotency_key`, import run ids, graph patch ids, source ids,
  work ids, and `(source_id, url)`.
- Import apply upserts a default unread state row and preserves existing read/save/archive state on conflict.
- Reader actions accept optional `idempotency_key`; if omitted, Life Graph records a timestamped event and updates current
  state idempotently for the `(work_id, actor_id)` row.
- Retention apply can be run repeatedly; already archived items are excluded by `is_hidden = false`.

## Implementation

- `jnap-life-graph/db/migrations/012_intel_reader_state_retention.sql`
- `jnap-life-graph/src/life_graph/intel.py`
- `jnap-life-graph/src/life_graph/server.py`
- `jnap-life-graph/src/life_graph/cli.py`
- `jnap-life-graph/bin/life-graph-intel-reader-*`
- `news-reader/src/life-graph-client.js`
- `news-reader/server.js`
- `news-reader/public/app.js`
- `news-reader/public/styles.css`
- `news-reader/scripts/life-graph-client.js`

## Validation

Life Graph:

- `PYTHONPATH=src python3 -m unittest discover -s tests`
- `bin/life-graph-validate`
- `python3 -m py_compile src/life_graph/intel.py src/life_graph/cli.py src/life_graph/server.py`
- `git diff --check`

News Reader:

- `node --check server.js`
- `node --check src/life-graph-client.js`
- `node --check public/app.js`
- `node --check scripts/life-graph-client.js`
- `npm run contracts`
- `npm run smoke`
- `git diff --check`

Live integration:

- apply the Life Graph migration
- start Life Graph API with the live database env
- start News Reader with `NEWS_READER_ITEMS_SOURCE=life_graph`
- apply an import
- list unread works
- mark one work read
- confirm it leaves unread and appears in read
- dry-run retention

## Stop Conditions

- Life Graph write token is missing for authenticated calls.
- The database migration has not been applied.
- Life Graph returns blockers.
- A reader action references an unknown work id.
- Empty Life Graph views must not trigger feed fallback.
- Any implementation tries to store or publish full article text without a separate rights/storage policy node.

## Handoff

The next node can assume the reader has DB-backed unread/read/saved/archived views and a dry-run retention command. Follow-up
nodes should add scheduled imports, source quality scoring, annotation/highlight capture, and relevance ranking as separate
research-locked exec plans.
