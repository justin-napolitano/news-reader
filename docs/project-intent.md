# Project Intent: Open Intel Graph

Status: draft
Updated: 2026-05-26

## Intent

This project is not just a news reader. The reader is the first wedge into a larger open-source, user-owned intelligence intake graph.

The goal is to help a person track what they read, watch, save, annotate, trust, reject, and connect to their own work. The system should reduce internet noise without hiding how it makes decisions. Sources, ranking rules, saved items, annotations, and graph edges should be inspectable and portable.

## Problem

The public internet is noisy, ad-heavy, manipulative, and fragmented. Good material is spread across news sites, blogs, public-domain books, papers, newsletters, videos, podcasts, documents, and repos. Most reader products optimize attention capture or opaque recommendation rather than user memory and judgment.

This project should become a personal intelligence system that answers:

- What did I encounter?
- Where did it come from?
- Did I read it, save it, dismiss it, or cite it?
- Which source produced it?
- Which topics, claims, people, projects, or questions does it connect to?
- Did it change what I think or what I should do next?

## First Wedge

The current app is a clean local reader:

- It indexes configured RSS and Atom feeds.
- It shows source filters and article metadata.
- It extracts readable text on demand.
- It keeps original source links visible.
- It does not persist extracted article copies.

That is the right first surface because it is useful immediately and introduces the core loop: discover, read, capture, connect.

## North Star

Build an open, transparent intake graph for a person's information life.

The system should support articles first, then extend to books, papers, newsletters, saved web pages, GitHub repos, documents, podcasts, videos, transcripts, notes, and manually captured ideas.

The long-term product is not a feed. It is a memory and source-governance layer.

## Core Principles

- User-owned: the user's graph, source list, notes, and events are portable.
- Transparent: source configuration, scoring, filters, and recommendations are visible.
- Source-respecting: store metadata, notes, annotations, tags, and summaries by default; avoid storing copyrighted full text unless the license permits it or the user explicitly owns the copy.
- Local-first: the system should run locally or self-hosted before relying on external services.
- Extensible: each intake channel should be a plugin or connector with a contract.
- Human-controlled: automation may suggest, cluster, enrich, or route; it should not silently rewrite the user's reading history or source preferences.
- Evidence-oriented: claims, annotations, and summaries should point back to the original source URL, work id, or captured citation.
- Idempotent: imports, graph patches, migrations, and scheduled runs should be replayable without duplicating facts or silently changing user state.
- Research-quality: implementation-driving claims should cite a bibliography entry, local artifact, code observation, or explicit project assumption.

## System Shape

This repo remains the first reader/client. It should evolve into an API-first intake service that can be orchestrated by the Codex platform or called directly by other clients.

The graph of record should live outside this UI once persistence is introduced. For Justin's system, the likely target is Jay Life Graph / `jnap-life-graph`, with this app acting as an intake client and source manager.

The expected architecture:

- Reader client: browses sources, opens readable views, captures user intent.
- Intake API: normalizes source metadata, works, events, annotations, and saves.
- Graph store: persists the user's source and work graph.
- Import connectors: RSS, Atom, Gutenberg, Crossref/OpenAlex, browser capture, GitHub, newsletters, and manual notes.
- Curation agents: propose tags, source ratings, reading queues, and project connections.
- Governance layer: contracts, exec plans, review gates, and source policy checks.

## Lineage And Relevance Posture

Everything important should be relatable, but not every relation is equally supported.

The graph should distinguish:

- source-authored claims
- user-authored notes
- agent-inferred tags
- deterministic imports
- ranking projections
- approved graph mutations

Relevance and ranking should explain why an item surfaced. A ranking result should point to the source records, graph edges, terms, annotations, user actions, or project links that produced it. Ranking is advisory by default; mutation requires a separate graph patch or user action.

Persistent graph changes should use idempotent patch and migration contracts. A repeated importer run should not create duplicate works, duplicate annotations, or duplicate source assessments.

## Core Graph Objects

- `Source`: a publisher, feed, API, library, person, repo, or site.
- `Work`: a stable intellectual object such as an article, book, paper, post, video, podcast episode, repo, or document.
- `WorkSegment`: a chapter, section, paragraph, quote, transcript segment, clip, or excerpt.
- `IntakeEvent`: a user interaction such as discovered, opened, read, saved, dismissed, annotated, cited, or shared.
- `Annotation`: a highlight, note, summary, claim extraction, question, or critique.
- `Topic`: a durable concept used for routing and clustering.
- `Entity`: a person, organization, place, product, dataset, repo, or other named thing.
- `Claim`: a statement extracted or authored by the user that should remain linked to evidence.
- `ProjectConnection`: an edge from a work or annotation to a user's project, resume fact, writing topic, or research question.
- `SourceAssessment`: a user's evolving evaluation of source quality, bias, usefulness, cost, and noise.

## Privacy And Capture Policy

Browser capture should be opt-in and visible. A bookmarklet or extension may send metadata, selected text, and user actions to a local intake endpoint, but it should not become hidden tracking.

The minimum capture payload should be:

- URL
- title
- source host
- timestamp
- user action
- optional selected text
- optional user note

The default should be metadata-first, not surveillance-first.

## Open Source Commitments

The project should be useful to other people without requiring Justin's private graph, keys, or personal source list.

The open-source version should provide:

- a clear source configuration format
- a local reader
- a local graph schema
- importers for open/public sources
- transparent ranking rules
- documentation for privacy and publisher-respect defaults
- optional adapters for external stores

## Workflow

This project should follow the research, plan, implement, review loop:

1. Research the product question and relevant standards.
2. Lock scope into a small node.
3. Write an exec plan for that node.
4. Implement the node.
5. Validate behavior with checks.
6. Review the result against the project intent and bibliography.

The first implementation work should preserve the current reader while adding contracts and persistence around it.
