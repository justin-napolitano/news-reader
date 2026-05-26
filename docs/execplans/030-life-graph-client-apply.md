# Life Graph Client Apply Path

ID: `ig-030-life-graph-client-apply`
Status: `implemented`
Scope owner: `news-reader`

## Intent

Make `news-reader` call the Life Graph-owned Intel API instead of stopping at local dry-run JSON.

The reader remains the feed/intake client. `jnap-life-graph` remains the database and graph owner. This node adds the
authenticated client path needed to dry-run, apply, and read back Intel sources and works through Life Graph.

## Research Lock

| Claim | Class | References | Why it matters | Implementation consequence |
| --- | --- | --- | --- | --- |
| Feed metadata should be replayable before mutation. | bibliography_backed | `bib-rss-2`, `bib-atom-rfc-4287`, `local-codex-biblio-execution-observability` | Feed polling will retry and scheduled runners must avoid duplicate writes. | Reuse the existing `life_graph_import` payload, idempotency keys, source hashes, import run, and graph patch. |
| Life Graph should own database writes. | implementation_observation | `jnap-life-graph:/api/intel/imports/news-reader/{dry-run,apply}` | The database schema, migrations, and audit trail live in Life Graph. | This repo only calls the Life Graph API; it does not connect directly to Postgres. |
| Reader UI needs a local fallback while the graph is empty or unreachable. | project_assumption | `docs/project-intent.md` | The reader must remain usable during local dev and before scheduled imports run. | `NEWS_READER_ITEMS_SOURCE=life_graph` reads from Life Graph first and falls back to feed indexing. |
| Write access must be explicit and secret-managed. | local_artifact_backed | `.env.example`, `jnap-life-graph:src/life_graph/auth.py` | The Life Graph API requires `X-Life-Graph-Write-Token`; hard-coded keys would break repo hygiene. | Use `LIFE_GRAPH_API_BASE_URL` and `LIFE_GRAPH_WRITE_TOKEN`; status exposes only configured booleans. |

## In Scope

- Add Life Graph client configuration.
- Add authenticated client calls for remote dry-run import, apply import, Intel source listing, and Intel work listing.
- Keep `POST /api/life-graph/import/dry-run` as local payload generation.
- Add reader feed loading from Life Graph `works` with feed fallback.
- Add package commands that call the local reader server.
- Update docs and smoke coverage.

## Out Of Scope

- Direct database writes from `news-reader`.
- New migrations in this repo.
- Annotation, save, ranking, or recommendation UI.
- Background scheduling.
- Admin login for Life Graph.

## API Surfaces

- `GET /api/life-graph/status`
- `POST /api/life-graph/import/remote-dry-run`
- `POST /api/life-graph/import/apply`
- `GET /api/life-graph/intel/sources`
- `GET /api/life-graph/intel/works`

## Commands

These commands expect the local reader server to be running:

- `npm run life-graph:status`
- `npm run life-graph:dry-run`
- `npm run life-graph:push-dry-run`
- `npm run life-graph:apply`
- `npm run life-graph:sources`
- `npm run life-graph:works`

## Mutation Policy

Local dry-run remains non-mutating. Remote dry-run calls Life Graph but should not write Intel rows. Apply calls
Life Graph's authenticated apply endpoint and may upsert into `intel_graph.sources`, `intel_graph.works`,
`intel_graph.import_runs`, and `intel_graph.graph_patches`.

## Idempotency

The apply path sends the same `life_graph_import` contract produced by the local dry-run endpoint. Idempotency is carried by:

- `life_graph_import.idempotency_key`
- `import_run.idempotency_key`
- `graph_patch.idempotency_key`
- per-source ids
- per-work ids and `(source_id, url)` uniqueness in Life Graph

## Stop Conditions

- `LIFE_GRAPH_API_BASE_URL` missing for remote calls.
- `LIFE_GRAPH_WRITE_TOKEN` missing for authenticated calls.
- Life Graph returns blockers.
- Local dry-run payload fails contract validation.
- Reader cannot map remote works into local article cards.

## Validation

- `npm run contracts`
- `npm run smoke`
- `node --check server.js`
- `node --check src/life-graph-client.js`
- `node --check scripts/life-graph-client.js`
- `git diff --check`

## Handoff

The next node can assume `news-reader` can push a generated import into Life Graph and can read back `intel_graph` works.
Follow-up nodes should add save/read events, annotations, and scheduled runner contracts.
