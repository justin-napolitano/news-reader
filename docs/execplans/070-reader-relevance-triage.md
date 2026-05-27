# Reader Relevance And Triage Initiative

ID: `nr-070-reader-relevance-triage`
Status: `proposed`
Scope owner: `news-reader` + `jnap-life-graph`

## Intent

Create a research-backed path from raw Life Graph article intake to explainable reading queues. This initiative intentionally delays ML and LLM-heavy features until the repo has contracts, evaluation fixtures, and enough user signals to avoid an opaque feed.

## Research Questions

- `rq-020-reader-relevance`
- `rq-021-news-importance`
- `rq-022-trend-and-duplicate-detection`
- `rq-023-ranking-explainability`
- `rq-024-human-control`

## Depends On

- `ig-040-reader-state-retention`
- `docs/research/reader-relevance-triage.md`
- current Life Graph Intel intake API

## Claim Ledger

| Claim | Class | Evidence Ref | Why It Matters | Build Consequence |
| --- | --- | --- | --- | --- |
| The first version should be deterministic and explainable, not a neural recommender. | bibliography_backed | `bib-news-rec-survey-2021`, `bib-explainable-rec-survey`, `bib-mind-news-rec` | The app does not yet have enough labeled user behavior to justify hidden personalization. | Build a baseline ranker with explicit component scores and reason codes. |
| Ranking must optimize beyond relevance/accuracy. | bibliography_backed | `bib-beyond-accuracy-rec`, `bib-editorial-values-news-rec` | A personally relevant feed can still be narrow, repetitive, or misleading. | Add diversity, novelty, redundancy, and source-fit fields to ranking contracts. |
| News importance requires event-level reasoning, not article-level recency alone. | bibliography_backed | `bib-tdt-nist` | Multiple articles can describe one event; trends need clustering and link detection. | Add event cluster and trend signal contracts before UI claims “trending.” |
| Users need transparency and control over news recommendations. | bibliography_backed | `bib-news-transparency-control-2024`, `bib-reuters-digital-news-report-2024` | The product exists to reduce noise and preserve agency. | UI queues must expose why items appeared and allow feedback. |
| Source assessments must be user-owned and multi-dimensional. | bibliography_backed, project_assumption | `bib-trust-project-indicators`, `local-researcher-source-provenance` | A single source trust label is too blunt and too easy to abuse. | Store source assessment dimensions instead of global truth labels. |
| Agentic curation is a risk surface. | bibliography_backed | `bib-nist-ai-rmf`, `docs/research/research-quality-gates.md` | Silent ranking mutations would make the tool another opaque platform feed. | Agent outputs remain advisory until a separate mutation policy lands. |

## Initiative DAG

### `nr-071-relevance-contracts`

Status: `proposed`
Depends on: none

Scope in:

- Add JSON schemas for ranking outputs:
  - `relevance-score.schema.json`
  - `ranking-run.schema.json`
  - `ranking-explanation.schema.json`
  - `reader-queue.schema.json`
  - `event-cluster.schema.json`
  - `trend-signal.schema.json`
  - `source-assessment.schema.json`
- Add fixtures for each contract.
- Extend contract validation.

Scope out:

- No production scoring.
- No database migration.
- No UI changes.

Mutation policy: read-only contract work.

Validation:

- `npm run contracts`
- `npm run smoke`

Stop conditions:

- Any score schema lacks evidence refs, missing evidence, algorithm id, version, tie breaker, and advisory/mutation policy.

### `nr-072-ranking-fixtures`

Status: `proposed`
Depends on: `nr-071-relevance-contracts`

Scope in:

- Add representative fixture works for high signal, duplicate, stale, advisory, investigation, personal-match, and fluff cases.
- Add expected ranking outputs against those fixtures.
- Add a small source-assessment fixture for current configured sources.

Scope out:

- No model training.
- No live graph writes.

Mutation policy: read-only fixture work.

Validation:

- Contract validation passes.
- Fixture ranking expected outputs are stable in git.

Stop conditions:

- Fixture labels are unsupported opinions without a declared project assumption or source assessment.

### `nr-073-baseline-ranker`

Status: `proposed`
Depends on: `nr-071-relevance-contracts`, `nr-072-ranking-fixtures`

Scope in:

- Add a deterministic ranking module over normalized reader items.
- Compute component scores:
  - `personal_relevance`
  - `public_importance`
  - `novelty`
  - `source_fit`
  - `freshness`
  - `redundancy_penalty`
- Return ranking explanations matching contract fixtures.
- Add local CLI/API preview endpoint.

Scope out:

- No LLM calls.
- No embeddings.
- No persistent ranking table.
- No automatic read/save/archive mutation.

Mutation policy: read-only preview.

Validation:

- `node --check` on touched JS files.
- `npm run contracts`
- `npm run smoke`
- deterministic fixture comparison.

Stop conditions:

- Ranking output is not reproducible.
- Any reason code cannot point to evidence or a declared project assumption.

### `nr-074-event-clustering-prototype`

Status: `proposed`
Depends on: `nr-071-relevance-contracts`, `nr-073-baseline-ranker`

Scope in:

- Add deterministic duplicate and event-cluster preview:
  - canonical URL normalization
  - title fingerprinting
  - source id grouping
  - publication-time windows
  - shared named entities when available
- Emit `event-cluster` and `trend-signal` fixtures.

Scope out:

- No semantic embeddings yet.
- No cross-language clustering.
- No “breaking news” claims.

Mutation policy: read-only preview.

Validation:

- Fixture clusters are stable.
- Duplicates are demoted but not deleted.

Stop conditions:

- Cluster output cannot explain why two works were linked.

### `nr-075-life-graph-ranking-projection`

Status: `proposed`
Depends on: `nr-073-baseline-ranker`, `nr-074-event-clustering-prototype`

Scope in:

- Add a dry-run Life Graph import/projection for ranking runs.
- Persist ranking runs only after dry-run validation.
- Keep ranking outputs private in `intel_graph`, not public Life Graph projections.

Scope out:

- No public website publication.
- No destructive pruning.

Mutation policy: dry-run first; apply requires explicit command and write token.

Validation:

- Life Graph dry-run returns created/updated/skipped/blocked counts.
- Re-running the same ranking run is idempotent.

Stop conditions:

- Missing migration backup.
- Non-idempotent ranking run ids.
- Ranking payload tries to overwrite user read/save/archive state.

### `nr-076-reader-queue-ui`

Status: `proposed`
Depends on: `nr-073-baseline-ranker`

Scope in:

- Add queue tabs:
  - `For You`
  - `Important`
  - `Advisories`
  - `Deep Reads`
  - `Trending`
  - `Low Signal`
- Add minimal explanation reveal for each card.
- Add feedback actions that only record user intent.

Scope out:

- No summary generation.
- No infinite-scroll engagement mechanics.
- No hiding original source links.

Mutation policy: UI reads ranking output; feedback uses existing reader state/intake event patterns.

Validation:

- `npm run smoke`
- manual mobile/desktop review
- queue state works with empty queues

Stop conditions:

- UI hides why an item is ranked.
- Queue labels imply authority that the score cannot support.

### `nr-077-agentic-curation-advisory`

Status: `proposed`
Depends on: `nr-075-life-graph-ranking-projection`, `nr-076-reader-queue-ui`

Scope in:

- Add an advisory-only curation agent plan.
- Agent may propose tags, topic links, source assessment updates, summaries, or project links.
- Agent outputs graph patches for review, not direct mutations.

Scope out:

- No autonomous publishing.
- No autonomous source trust changes.
- No automatic read/save/archive decisions.

Mutation policy: advisory; human review required before graph mutation.

Validation:

- Agent output validates as graph patch.
- Unsupported claims are blocked.
- Every proposed summary cites source work ids.

Stop conditions:

- Any agent output lacks evidence refs or tries to mutate without review.

## Cross-Cutting Contracts

All ranking nodes must preserve:

- `algorithm_id`
- `algorithm_version`
- `candidate_set_id`
- `run_id`
- `score`
- `component_scores`
- `reason_codes`
- `evidence_refs`
- `missing_evidence`
- `tie_breaker`
- `confidence`
- `advisory_only`
- `created_at`

## Handoff

After `nr-071` and `nr-072`, implementation can begin safely with a local deterministic baseline. After `nr-073`, the reader can preview ranked queues without mutating Life Graph. Persistent ranking and UI work should wait until the baseline produces stable, inspectable outputs.

