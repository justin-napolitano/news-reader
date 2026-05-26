# LifeDB Dry-Run Import Adapter

ID: `ig-020-lifedb-dry-run-import`
Status: `implemented`
Scope owner: `news-reader`

## Intent

Make `news-reader` produce Life Graph-compatible import payloads before any live database write exists.

The reader remains the intake client. LifeDB remains the graph of record, but raw intelligence gets a typed `intel_graph`
domain schema instead of being forced into generic Life Graph objects. This slice adds the contracts, SQL migration proposal,
schema plan, and dry-run endpoint needed to review that boundary.

## Research Lock

| Claim | Class | References | Why it matters | Implementation consequence |
| --- | --- | --- | --- | --- |
| Feed articles should enter LifeDB as source-backed works, not UI cards. | bibliography_backed | `bib-rss-2`, `bib-atom-rfc-4287`, `bib-schema-creativework` | Feed formats differ, but LifeDB needs stable objects. | Normalize feed items into `Work`, then into private Life Graph `life_object` records. |
| Source and work provenance must be explicit before curation or ranking. | bibliography_backed | `bib-prov-dm`, `local-researcher-source-provenance` | Future ranking and synthesis need inspectable evidence. | Every Life Graph object gets provenance and original intel payload. |
| Importers must be replayable and auditable. | local_artifact_backed | `local-codex-biblio-execution-observability`, `local-researcher-local-orchestration-api` | Scheduled source polling will retry. | Add idempotency keys, source hashes, import runs, graph patches, and migration checks. |
| Annotations need their own table even before UI capture exists. | bibliography_backed | `bib-web-annotation` | Saved notes/highlights need durable targets. | Add `intel_graph.annotations` in the proposed migration, but do not create annotations yet. |
| Raw intelligence needs a typed domain schema inside LifeDB. | project_assumption | `docs/schema/intel-graph-lifedb.md` | Sources, works, claims, annotations, events, and scores have different lifecycles than public personal-site objects. | Keep raw intel canonical in `intel_graph`; promote only selected records into `public.life_graph_objects`. |
| LifeDB should remain canonical while this repo stays adapter/client. | implementation_observation | `jnap-life-graph:schemas/life-graph-object.schema.json`, `jnap-life-graph:db/migrations/001_life_graph_core.sql` | Existing Life Graph already owns objects, edges, projections, curation, and imports. | Proposed SQL uses a separate `intel_graph` schema plus mapping rows to `public.life_graph_objects`. |

## In Scope

- Add Life Graph import and migration-manifest contracts.
- Add the LifeDB intel schema plan contract.
- Add an unapplied LifeDB migration proposal under `integrations/life-graph/migrations`.
- Map configured sources and feed works to private Life Graph objects.
- Emit `derived_from_source` edges.
- Expose `GET /api/life-graph/migrations`.
- Expose `POST /api/life-graph/import/dry-run`.
- Validate migration safety and dry-run idempotency in smoke tests.

## Out Of Scope

- Applying migrations to Postgres.
- Writing to `jnap-life-graph`.
- Authentication or write-token handling.
- Curation UI for imported works.
- Ranking, source scoring, or recommendation logic.

## Migration Boundary

Proposed migration:

- `integrations/life-graph/migrations/003_news_reader_intel_intake.sql`

Creates:

- `intel_graph.import_runs`
- `intel_graph.graph_patches`
- `intel_graph.sources`
- `intel_graph.works`
- `intel_graph.work_segments`
- `intel_graph.intake_events`
- `intel_graph.annotations`
- `intel_graph.entities`
- `intel_graph.topics`
- `intel_graph.claims`
- `intel_graph.work_entities`
- `intel_graph.work_topics`
- `intel_graph.source_assessments`
- `intel_graph.relevance_scores`
- `intel_graph.project_connections`
- `intel_graph.life_graph_mappings`

The migration is schema-only and idempotent. It requires the Life Graph core migration because mappings reference
`public.life_graph_objects(id)`.

## API Surfaces

- `GET /api/life-graph/migrations`: returns the migration manifest in a Life Graph-style API envelope.
- `POST /api/life-graph/import/dry-run`: returns a `life_graph_import` contract with objects, edges, migration refs, source hash, and audit notes.

## Validation

- `npm run contracts`
- `npm run smoke`
- `node --check server.js`
- `node --check src/life-graph-adapter.js`
- `git diff --check`

## Next Node

`ig-030-lifedb-apply-mode-design`: define authenticated apply mode against `jnap-life-graph`, including write-token handling,
conflict behavior, and whether migration ownership moves into the Life Graph repo.
