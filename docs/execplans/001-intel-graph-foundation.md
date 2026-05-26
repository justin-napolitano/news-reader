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
- `rq-011-idempotent-graph-patches`
- `rq-012-relevance-ranking`

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
- Add graph patch and migration rules before persistent writes exist.
- Add relevance/ranking gates before any recommendation or curation algorithm exists.

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
3. `ig-015-graph-patch-contract`: define idempotent patch, migration, and import-run contracts before persistent graph writes.
4. `ig-020-source-migration`: validate and normalize `data/sources.json` against the `Source` contract.
5. `ig-030-work-normalizer`: normalize RSS and Atom items into `Work` objects.
6. `ig-040-event-sink`: record user intake events locally.
7. `ig-050-reader-capture`: add save, dismiss, note, and source-quality actions to the reader UI.
8. `ig-060-graph-api`: expose source, work, event, and annotation endpoints.
9. `ig-070-life-graph-adapter`: push normalized graph events into Jay Life Graph.
10. `ig-080-gutenberg-importer`: ingest public-domain book metadata and text where permitted.
11. `ig-090-scholar-importer`: ingest DOI and scholarly metadata from Crossref/OpenAlex.
12. `ig-100-browser-capture`: add opt-in bookmarklet or extension capture.
13. `ig-105-relevance-scoring-contract`: define relevance result, source-quality score, graph-distance, and ranking explanation contracts.
14. `ig-110-curation-agent`: suggest tags, topics, source assessments, and project connections with human review.

## Contracts To Add In Next Slice

- `contracts/source.schema.json`
- `contracts/work.schema.json`
- `contracts/intake-event.schema.json`
- `contracts/annotation.schema.json`
- `contracts/topic.schema.json`
- `contracts/entity.schema.json`
- `contracts/claim.schema.json`
- `contracts/project-connection.schema.json`
- `contracts/graph-patch.schema.json`
- `contracts/import-run.schema.json`
- `contracts/relevance-result.schema.json`

## Claim Ledger

| Claim | Class | Evidence Ref | Why It Matters | Build Consequence |
| --- | --- | --- | --- | --- |
| Feed items should normalize to stable works rather than UI-only cards. | bibliography_backed | `bib-rss-2`, `bib-atom-rfc-4287`, `bib-schema-creativework` | RSS and Atom represent source items differently, while the graph needs a common object. | Add `Work` contract before expanding feeds. |
| Annotations should preserve body, target, motivation, and selector-like evidence. | bibliography_backed | `bib-web-annotation` | Highlights and notes need durable source anchors. | Add `Annotation` and `WorkSegment` fields before note capture. |
| Source and claim provenance must be explicit before synthesis or agentic curation. | local_artifact_backed | `local-researcher-source-provenance` | The researcher system already separates source records, locators, verification, and claim graph state. | Add provenance fields to contracts and block unsupported claims. |
| Relevance ranking should preserve evidence ids and gaps, not just scores. | local_artifact_backed | `local-resume-agent-architecture`, `local-creative-resume-job-workflow` | Resume workflows already use ranked evidence and source fact ids to prevent invented claims. | Design `relevance-result` before curation. |
| Persistent graph writes must be replayable and auditable. | local_artifact_backed | `local-researcher-local-orchestration-api`, `local-codex-biblio-execution-observability` | Scheduled imports and agent calls will retry. Non-idempotent writes would corrupt the graph. | Add graph patch and import-run contracts before database writes. |

## Validation

- `npm run smoke`
- Manual check: front page still lists configured sources and articles.
- Manual check: reader page still opens an article by URL.
- Contract check: sample source and work fixtures validate.
- Policy check: no copyrighted full article text is persisted by default.
- Research-quality check: every implementation-driving claim has a claim-ledger evidence ref or is marked as a project assumption.
- Migration check: any graph write has dry-run, idempotency, duplicate handling, and audit output.
- Relevance check: any ranking output includes score, reason codes, evidence refs, missing evidence, and deterministic tie breaker.

## Stop Conditions

- Source contracts cannot represent current `data/sources.json` without dropping required fields.
- Reader extraction changes persist article text without explicit policy.
- Event capture cannot distinguish user intent from passive page load.
- Any Jay Life Graph integration requires credentials or schema assumptions not present in this repo.
- A graph migration cannot be replayed without duplicate writes or state drift.
- A relevance/ranking feature returns scores without evidence refs and reason codes.

## Handoff

The next slice should implement `ig-010-contracts` first. After that, every new intake source should be contract-backed and bibliography-linked.
