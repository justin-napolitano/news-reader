# Exec Plan: Intel Graph Contracts

ID: `ig-010-contracts`
Status: implemented
Updated: 2026-05-26

## Purpose

Create the first contract-backed graph substrate for the reader without introducing persistent graph writes.

## Claim Ledger

| Claim | Class | Evidence Ref | Why It Matters | Build Consequence |
| --- | --- | --- | --- | --- |
| Feed metadata needs a normalized `Work` shape before it can support annotations, saves, or graph search. | bibliography_backed | `bib-rss-2`, `bib-atom-rfc-4287`, `bib-schema-creativework` | RSS and Atom feed items vary by source. | Add `work.schema.json` and normalize fixture feed items into `Work`. |
| Source definitions need explicit rights and provenance metadata. | bibliography_backed | `bib-prov-dm`, `local-researcher-source-provenance` | The reader should not confuse feed config with publication rights or claim authority. | Add `source.schema.json` and map `data/sources.json` into metadata-only sources. |
| Graph writes need idempotent patch envelopes before persistence. | local_artifact_backed | `local-codex-biblio-execution-observability`, `local-researcher-local-orchestration-api` | Scheduled importers and agents will retry. | Add `graph-patch.schema.json`, `import-run.schema.json`, dry-run patch output, and idempotency keys. |
| Relevance results need explanation fields before ranking exists. | local_artifact_backed | `local-resume-agent-architecture`, `local-creative-resume-job-workflow` | Ranking should surface evidence and gaps rather than unexplained scores. | Add `relevance-result.schema.json`; no ranking algorithm is implemented yet. |

## Scope In

- Add JSON schemas for the first graph object set.
- Add fixture objects for every schema.
- Add a dependency-free validator for the schema subset used here.
- Validate configured sources as normalized graph sources.
- Normalize feed items into `Work` objects.
- Expose read-only graph API endpoints for normalized sources and works.
- Return dry-run graph patch and import-run metadata with graph work output.
- Extend smoke tests to cover the graph endpoints.

## Scope Out

- No database.
- No Jay Life Graph writes.
- No browser capture.
- No save/dismiss/read event persistence.
- No source-quality scoring.
- No ranking algorithm.
- No copyrighted full-text storage.

## API Surfaces

- `GET /api/graph/sources`
- `GET /api/graph/contracts`
- `GET /api/graph/works`

These endpoints are read-only. `GET /api/graph/works` includes an `import_run` and `dry_run_patch` preview so downstream tools can inspect what would be upserted later.

## Validation

```bash
npm run contracts
npm run smoke
```

## Handoff

The next implementation node can safely build either:

- `ig-040-event-sink`: local read/save/dismiss event capture against `intake-event.schema.json`
- `ig-060-graph-api`: richer read-only graph API surface and contract discovery
- `ig-070-life-graph-adapter`: only after Jay Life Graph schema assumptions are explicit
