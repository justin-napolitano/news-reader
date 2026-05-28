# Reader Memory and Deterministic Extraction Exec Plan

## Scope

Build durable memory primitives for News Reader without LLM extraction.

Included:
- Persist reader relevance controls in Life Graph.
- Save article notes as graph annotations.
- Generate deterministic extraction candidates from article metadata.
- Provide a review queue before applying extracted topics, entities, and relevance scores.

Out of scope:
- LLM extraction.
- Automatic promotion of candidates into trusted facts.
- Long-term behavioral ranking models.
- Full-text storage beyond the existing metadata-first policy.

## Architecture

Life Graph remains the source of durable memory. News Reader calls typed APIs only; it does not write SQL or mutate the database directly.

News Reader responsibilities:
- Collect preferences, notes, and review actions.
- Render extraction candidates for human review.
- Keep browser-local preferences only as an offline fallback.

Life Graph responsibilities:
- Store preferences in `intel_graph.reader_preferences`.
- Store notes in `intel_graph.annotations`.
- Produce deterministic extraction candidates from `intel_graph.works`.
- Apply reviewed candidates idempotently into `intel_graph.topics`, `intel_graph.entities`, `intel_graph.work_topics`, `intel_graph.work_entities`, and `intel_graph.relevance_scores`.

## Acceptance Checks

- Relevance controls still work when Life Graph is unavailable.
- When Life Graph is configured, controls load from and save to Life Graph.
- Reader notes require a graph-backed `work_id` and save through a typed API.
- Extraction review is dry-run by default.
- Extraction apply is explicit and idempotent.
- No LLM or model API is called.

## Validation

- Life Graph: `PYTHONPATH=src uv run python -m unittest tests.test_life_graph`
- News Reader: `npm run smoke`

