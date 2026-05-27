# Reader Relevance And Triage Research Note

Status: draft
Updated: 2026-05-27

## Intent

This note scopes the next research initiative for turning News Reader from an intake surface into a personal intelligence triage system. The goal is not to maximize clicks, time-on-site, or generic engagement. The goal is to help Justin separate useful signal from noise while keeping every ranking decision inspectable, reversible, and grounded in Life Graph evidence.

## Research Questions

### `rq-020-reader-relevance`

How should the reader identify works that are personally relevant to Justin without collapsing into an echo chamber?

### `rq-021-news-importance`

How should the reader identify broadly important news without treating volume, outrage, or recency as authority?

### `rq-022-trend-and-duplicate-detection`

How should the reader cluster stories into events, detect repeated coverage, and suppress duplicate rewrites?

### `rq-023-ranking-explainability`

What evidence must a ranking output expose so a human or agent can challenge it?

### `rq-024-human-control`

Which ranking actions are advisory, which may update reader state, and which require explicit human review?

## Working Findings

| Finding | Claim Class | Evidence Refs | Consequence |
| --- | --- | --- | --- |
| News recommendation is not just standard recommendation with fresher items; it has stronger cold-start, freshness, diversity, and interpretability problems. | bibliography_backed | `bib-news-rec-survey-2021`, `bib-personalized-news-survey-2023`, `bib-mind-news-rec` | Build a deterministic baseline before any neural or agentic ranker. |
| Content understanding and user-interest modeling are both necessary, but this repo currently has weak user-interest data beyond read/save/dismiss events. | bibliography_backed, implementation_observation | `bib-mind-news-rec`, `server.js`, `docs/execplans/040-reader-state-retention.md` | Do not claim personalization quality yet; call the first version a transparent triage prototype. |
| A single relevance score is dangerous because it can hide popularity bias, source bias, duplicate stories, or personal tunnel vision. | bibliography_backed | `bib-beyond-accuracy-rec`, `bib-editorial-values-news-rec` | Model multiple component scores and expose reason codes. |
| News fatigue and avoidance are product risks, not just UX preferences. | bibliography_backed | `bib-reuters-digital-news-report-2024` | Add queue caps, quiet states, and low-noise views before increasing source volume. |
| Topic/event tracking is a separate problem from article ranking. | bibliography_backed | `bib-tdt-nist` | Build event clusters and duplicate suppression before calling an item “trending.” |
| Source trust is not binary and should not be outsourced to a hidden authority list. | bibliography_backed, project_assumption | `bib-trust-project-indicators`, `local-researcher-source-provenance` | Store user-owned source assessments with evidence fields; avoid automatic “trusted/untrusted” labels. |
| Explainability must be designed as a contract, not a UI afterthought. | bibliography_backed | `bib-explainable-rec-survey`, `bib-news-transparency-control-2024`, `docs/research/research-quality-gates.md` | Ranking outputs need evidence refs, missing evidence, tie breakers, and uncertainty notes from day one. |
| Any agentic ranking or curation process is an AI risk surface if it silently changes what the user sees. | bibliography_backed | `bib-nist-ai-rmf` | Keep agent outputs advisory until a separate review and mutation policy exists. |

## Critical Assessment

The most likely bad version of this project is an opaque personal recommender with a prettier UI. That would recreate the feed dynamics this tool is supposed to escape: over-personalization, outrage weighting, popularity bias, hidden source assumptions, and shallow recency chasing.

The second likely failure is overbuilding a “research-grade” recommender before the graph has enough clean user signals. The current graph knows sources, works, read state, saved state, and dismissals. That is enough for rule-based triage and enough to collect training/evaluation data, but not enough for defensible personalized ML.

The third failure is confusing “important” with “widely covered.” A story can be widely covered because it is important, but also because it is cheap to rewrite, politically inflamed, search-optimized, or emotionally sticky. Trend signals need source diversity, event clustering, institutional/entity impact, source type, and novelty checks. Coverage count alone is not a valid importance measure.

The fourth failure is assuming LLM summaries solve filtering. Summaries can make bad intake more consumable, but they do not decide what deserves attention. Summaries should come after ranking contracts, citation requirements, and a stored explanation model.

## First-Pass Signal Model

The first ranker should be deterministic and boring:

- `personal_relevance`: matches against Life Graph projects, topics, saved works, annotations, explicitly followed sources, and recurring user actions.
- `public_importance`: official advisories, institutional actors, legal/regulatory/security impact, investigation depth, source role, and cross-source event coverage.
- `novelty`: new source, new entity, new topic, first-story signal, or new angle inside an existing event cluster.
- `redundancy`: near-duplicate title/URL/content fingerprints, same event cluster, same source rewrite pattern.
- `source_fit`: user-owned assessment of source quality, noise, rights, cost/paywall, readability, and domain relevance.
- `freshness`: publication time and event lifecycle, decayed by source/update type.
- `user_friction`: paywall likelihood, extraction failure risk, article length, and prior dismiss patterns.

The first output should not be `score: 0.87`. It should be a structured explanation:

```json
{
  "work_id": "work:example",
  "algorithm_id": "reader_relevance_baseline.v1",
  "queue": "important",
  "score": 72,
  "component_scores": {
    "personal_relevance": 18,
    "public_importance": 31,
    "novelty": 10,
    "source_fit": 9,
    "freshness": 4,
    "redundancy_penalty": 0
  },
  "reason_codes": ["official_advisory", "matches_security_interest", "high_source_fit"],
  "evidence_refs": ["source:cisa-advisories", "topic:cybersecurity", "event:..."],
  "missing_evidence": ["no_user_annotation"],
  "tie_breaker": "published_at_desc_then_work_id",
  "advisory_only": true
}
```

## Queue Model

The UI should eventually expose queues, not one endless feed:

- `For You`: high personal relevance with explanation.
- `Important`: high public importance even if not personally matched.
- `Advisories`: CISA/security/regulatory/official items.
- `Deep Reads`: investigations, analysis, long-form, slow-burn items.
- `Trending Events`: event clusters with multiple independent source references.
- `New To Me`: novelty and serendipity, capped to avoid randomness.
- `Low Signal`: low score, duplicate, stale, or repeatedly dismissed patterns.
- `Saved`: explicit user saves.

Every queue should be reproducible from a named ranking run.

## Scope Warnings

- Do not build collaborative filtering. There is one primary user and no ethical basis yet for cross-user behavior sharing.
- Do not use generic social share counts as an importance proxy. They are easy to game and often amplify noise.
- Do not let AI summaries or agents mutate read/save/archive state.
- Do not hide articles solely because they disagree with past behavior. Personal relevance should not become personal insulation.
- Do not delete old works during ranking. Ranking may hide, demote, or archive by policy only after a separate retention/prune node.
- Do not create a “source truth score.” Create source assessments with evidence, dimensions, and user override.

## Required Contracts

- `relevance-score.schema.json`
- `ranking-run.schema.json`
- `ranking-explanation.schema.json`
- `reader-queue.schema.json`
- `event-cluster.schema.json`
- `source-assessment.schema.json`
- `trend-signal.schema.json`

## Implementation Posture

The next build should be research/contracts only, then a read-only baseline ranker. Persistent ranking outputs can land after the contracts are validated. Agentic curation belongs later and must be advisory by default.

