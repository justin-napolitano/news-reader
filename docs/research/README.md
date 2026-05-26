# Research System

This directory holds the research spine for the Open Intel Graph.

Research should not be a loose pile of links. Each research question should produce a scoped recommendation that can become one or more exec plan nodes.

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

## Output Rule

Every answered research question should produce at least one of:

- a contract change
- a migration plan
- an exec plan node
- a rejected-path note explaining what not to build

