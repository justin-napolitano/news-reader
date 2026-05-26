# Intel Graph LifeDB Schema

Status: proposed

The intelligence tool should own a typed `intel_graph` schema inside LifeDB. It should not force every raw article, source,
claim, or event into the generic Life Graph object table.

## Boundary

- `intel_graph`: canonical raw and reviewed intelligence intake data.
- `public.life_graph_objects`: curated cross-domain objects promoted from intel only when useful outside the reader.
- `public.life_graph_projections`: public/site-facing projection layer.

This keeps LifeDB as the one database while avoiding a single generic junk drawer.

## Research Basis

| Area | Evidence refs | Schema consequence |
| --- | --- | --- |
| Feeds | `bib-rss-2`, `bib-atom-rfc-4287` | Sources and works preserve source ids, feed URLs, item identifiers, and publication dates. |
| Works | `bib-schema-creativework`, `bib-schema-article`, `bib-schema-book` | Articles, books, papers, posts, videos, and documents share a `works` base table. |
| Annotation | `bib-web-annotation` | Notes, highlights, questions, quotes, and selectors have a dedicated `annotations` table. |
| Provenance | `bib-prov-dm`, `local-researcher-source-provenance` | Sources, works, claims, entities, and links carry provenance and source hashes. |
| Activity | `bib-activitystreams`, `bib-cloudevents`, `bib-trace-context` | Opens, saves, reads, dismissals, and citations are captured as idempotent `intake_events`. |
| Lineage | `bib-openlineage`, `local-codex-biblio-execution-observability` | Imports and graph patches have run records, source hashes, and replayable audit output. |
| Relevance | `local-resume-agent-architecture`, `bib-career-aware-rag-resume-tailoring` | Scores are advisory records with evidence refs, reason codes, missing evidence, and tie breakers. |

## Tables

- `intel_graph.import_runs`: importer execution audit.
- `intel_graph.graph_patches`: dry-run/apply graph mutation envelopes.
- `intel_graph.sources`: publishers, feeds, libraries, people, APIs, repositories, and sites.
- `intel_graph.works`: articles, books, papers, posts, videos, podcast episodes, repositories, documents, and notes.
- `intel_graph.work_segments`: chapters, paragraphs, transcript spans, quoted ranges, and selected excerpts.
- `intel_graph.intake_events`: discovered, opened, read, saved, dismissed, queued, cited, annotated.
- `intel_graph.annotations`: highlights, notes, comments, questions, summaries, quotes.
- `intel_graph.entities`: people, organizations, places, products, repositories, concepts.
- `intel_graph.topics`: controlled or emergent topics.
- `intel_graph.claims`: source-backed claims with confidence, stance, and provenance.
- `intel_graph.work_entities`: work/segment to entity links.
- `intel_graph.work_topics`: work/segment to topic links.
- `intel_graph.source_assessments`: user-owned quality, reliability, noise, coverage, and trust records.
- `intel_graph.relevance_scores`: advisory scoring outputs.
- `intel_graph.project_connections`: links from intel to projects, writing, resumes, job searches, or other domains.
- `intel_graph.life_graph_mappings`: promotion bridge into `public.life_graph_objects`.

## Promotion Rules

Raw feed data stays in `intel_graph` by default.

Intel is promoted into `public.life_graph_objects` only when it becomes cross-domain material: saved references, cited works,
project evidence, writing inputs, resume/career evidence, or public site material.

Agent-generated topics, claims, and relevance scores are advisory until a user action or graph patch applies them.

Public websites should consume Life Graph projections. They should not read raw intel tables directly.

## Migration

The proposed SQL migration is:

- `integrations/life-graph/migrations/003_news_reader_intel_intake.sql`

It is schema-only and idempotent. It is not applied by this repo.
