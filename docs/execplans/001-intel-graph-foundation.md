# Exec Plan: Intel Graph Foundation

ID: `ig-001-intel-graph-foundation`
Status: proposed
Updated: 2026-05-26

## Purpose

Convert the current local reader into the first client for an open intelligence intake graph without breaking the existing reader experience.

## Research Questions

- `rq-001-source-and-work-model`
- `rq-002-content-rights`
- `rq-003-reader-extraction`
- `rq-004-annotation-model`
- `rq-005-provenance`

## Dependencies

- Current reader MVP exists and passes smoke checks.
- Project intent and bibliography exist.

## Scope In

- Add JSON contracts for `Source`, `Work`, `IntakeEvent`, and `Annotation`.
- Map current `data/sources.json` source entries into the new `Source` contract.
- Add a local graph event sink that can record `discovered`, `opened`, `saved`, and `dismissed` events.
- Keep readable article extraction on demand.
- Persist metadata and user events only.
- Add a route or API endpoint that exposes the normalized graph objects for downstream clients.
- Add tests or smoke checks proving the reader still works.

## Scope Out

- No remote database migration.
- No AI summarization.
- No browser extension.
- No full-text archival for copyrighted news articles.
- No ranking algorithm beyond current source and date ordering.
- No Jay Life Graph write integration yet.

## Proposed Node DAG

1. `ig-001-intel-graph-foundation`: create intent, research, bibliography, and roadmap docs.
2. `ig-010-contracts`: add JSON schemas for source, work, intake event, annotation, topic, entity, claim, and project connection.
3. `ig-020-source-migration`: validate and normalize `data/sources.json` against the `Source` contract.
4. `ig-030-work-normalizer`: normalize RSS and Atom items into `Work` objects.
5. `ig-040-event-sink`: record user intake events locally.
6. `ig-050-reader-capture`: add save, dismiss, note, and source-quality actions to the reader UI.
7. `ig-060-graph-api`: expose source, work, event, and annotation endpoints.
8. `ig-070-life-graph-adapter`: push normalized graph events into Jay Life Graph.
9. `ig-080-gutenberg-importer`: ingest public-domain book metadata and text where permitted.
10. `ig-090-scholar-importer`: ingest DOI and scholarly metadata from Crossref/OpenAlex.
11. `ig-100-browser-capture`: add opt-in bookmarklet or extension capture.
12. `ig-110-curation-agent`: suggest tags, topics, source assessments, and project connections with human review.

## Contracts To Add In Next Slice

- `contracts/source.schema.json`
- `contracts/work.schema.json`
- `contracts/intake-event.schema.json`
- `contracts/annotation.schema.json`
- `contracts/topic.schema.json`
- `contracts/entity.schema.json`
- `contracts/claim.schema.json`
- `contracts/project-connection.schema.json`

## Validation

- `npm run smoke`
- Manual check: front page still lists configured sources and articles.
- Manual check: reader page still opens an article by URL.
- Contract check: sample source and work fixtures validate.
- Policy check: no copyrighted full article text is persisted by default.

## Stop Conditions

- Source contracts cannot represent current `data/sources.json` without dropping required fields.
- Reader extraction changes persist article text without explicit policy.
- Event capture cannot distinguish user intent from passive page load.
- Any Jay Life Graph integration requires credentials or schema assumptions not present in this repo.

## Handoff

The next slice should implement `ig-010-contracts` first. After that, every new intake source should be contract-backed and bibliography-linked.

