# Research System

This directory holds the research spine for the Open Intel Graph.

Research should not be a loose pile of links. Each research question should produce a scoped recommendation that can become one or more exec plan nodes.

Use [Research Quality Gates](research-quality-gates.md) before any implementation slice. The [Local Resource Review](local-resource-review.md) records the platform, researcher, and resume artifacts already imported into this repo's planning layer. Future plans should not contain open-ended product or architecture claims without a bibliography id, a local artifact ref, or an explicit project assumption.

## Research Question Format

Use this structure for future research notes:

```yaml
id: rq-000
title: Short research question
status: proposed | active | answered | superseded
decision_needed: What implementation or product choice this unlocks
scope:
  in: What this question covers
  out: What this question does not cover
sources:
  - title: Source title
    url: https://example.com
    evidence_level: standard | official-doc | peer-reviewed | implementation | field-note
findings:
  - Finding with source reference
recommendation: Concrete project guidance
follow_up_nodes:
  - execplan-id
claim_ledger:
  - claim: Concise claim the plan depends on
    class: bibliography_backed | local_artifact_backed | implementation_observation | project_assumption | open_question
    evidence_ref: bib-or-local-ref
    why_it_matters: Why this claim affects the build
    build_consequence: What implementation choice follows
```

## Evidence Levels

- `standard`: formal web, metadata, protocol, accessibility, or interoperability standard.
- `official-doc`: official API, platform, or project documentation.
- `peer-reviewed`: paper, report, book, or formal research source.
- `implementation`: mature library, open-source implementation, or production example.
- `field-note`: product observation, personal note, or design reference.

Prefer standards and official docs for data contracts. Use implementation references for build tactics. Use field notes for product feel, never for protocol truth.

## Initial Questions

- `rq-001-source-and-work-model`: Which metadata shape should represent articles, books, papers, repos, videos, and manually saved pages?
- `rq-002-content-rights`: What can we store safely by default without becoming a republishing surface?
- `rq-003-reader-extraction`: How should readable article extraction work, fail, and preserve attribution?
- `rq-004-annotation-model`: How should highlights, notes, quotes, claims, and citations map into the graph?
- `rq-005-provenance`: How do we preserve where every object, summary, tag, and edge came from?
- `rq-006-ranking-and-curation`: How should sources and works be ranked without opaque attention algorithms?
- `rq-007-browser-capture`: What is the minimum ethical browser capture mechanism?
- `rq-008-gutenberg-import`: How should public-domain books enter the graph?
- `rq-009-scholar-import`: How should papers and DOI metadata enter the graph?
- `rq-010-agent-workflows`: Which agent actions should be allowed to enrich the graph, and which require human review?
- `rq-011-idempotent-graph-patches`: What patch and migration contract keeps graph writes replayable, auditable, and safe?
- `rq-012-relevance-ranking`: Which relevance signals should rank works, sources, annotations, and project connections without hiding evidence or mutating state by default?

## Output Rule

Every answered research question should produce at least one of:

- a contract change
- a migration plan
- an exec plan node
- a rejected-path note explaining what not to build

## Implementation Readiness Rule

A research question is not ready to become implementation until it has:

- at least one evidence ref or a clearly labeled project assumption
- a scoped recommendation
- explicit non-goals
- a validation path
- a known mutation policy when graph state is touched
