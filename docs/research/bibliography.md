# Initial Bibliography

Status: draft
Updated: 2026-05-27

This bibliography starts with primary standards and official documentation. Future research notes should cite these entries by id.

## Feed And Syndication

### `bib-rss-2`

- Title: RSS 2.0 Specification
- Publisher: RSS Advisory Board
- URL: https://www.rssboard.org/rss-specification
- Evidence level: standard
- Relevance: Defines the current RSS 2.0 feed shape used by many news and blog sources. Important fields include channel metadata, item metadata, `guid`, `pubDate`, `source`, and cache hints.

### `bib-atom-rfc-4287`

- Title: RFC 4287: The Atom Syndication Format
- Publisher: RFC Editor / IETF
- URL: https://www.rfc-editor.org/rfc/rfc4287
- Evidence level: standard
- Relevance: Defines Atom feeds. Needed for source ingestion parity with RSS.

### `bib-websub`

- Title: WebSub
- Publisher: W3C
- URL: https://www.w3.org/TR/websub/
- Evidence level: standard
- Relevance: Defines a publish-subscribe mechanism for feed updates. Useful later if polling becomes too slow or wasteful.

## Annotation, Activity, And Provenance

### `bib-web-annotation`

- Title: Web Annotation Data Model
- Publisher: W3C
- URL: https://www.w3.org/TR/annotation-model/
- Evidence level: standard
- Relevance: Defines a model for annotations with bodies, targets, motivations, selectors, and agents. Strong basis for highlights, notes, quotes, and comments.

### `bib-prov-dm`

- Title: PROV-DM: The PROV Data Model
- Publisher: W3C
- URL: https://www.w3.org/TR/prov-dm/
- Evidence level: standard
- Relevance: Defines provenance concepts such as entities, activities, and agents. Useful for tracking how works, summaries, tags, and graph edges were created.

### `bib-activitystreams`

- Title: Activity Streams 2.0
- Publisher: W3C
- URL: https://www.w3.org/TR/activitystreams-core/
- Evidence level: standard
- Relevance: Defines an activity vocabulary for actions and objects. Useful for normalizing `opened`, `saved`, `dismissed`, `annotated`, and similar intake events.

## Creative Work Metadata

### `bib-schema-creativework`

- Title: Schema.org CreativeWork
- Publisher: Schema.org
- URL: https://schema.org/CreativeWork
- Evidence level: standard
- Relevance: General model for creative works including books, articles, software, media, and web pages. Good base vocabulary for work contracts.

### `bib-schema-article`

- Title: Schema.org Article
- Publisher: Schema.org
- URL: https://schema.org/Article
- Evidence level: standard
- Relevance: Article-specific fields for news, essays, and posts.

### `bib-schema-book`

- Title: Schema.org Book
- Publisher: Schema.org
- URL: https://schema.org/Book
- Evidence level: standard
- Relevance: Book-specific metadata for Gutenberg and other long-form reading sources.

## Scholarly Metadata

### `bib-crossref-rest`

- Title: Crossref REST API
- Publisher: Crossref
- URL: https://www.production.crossref.org/documentation/retrieve-metadata/rest-api/
- Evidence level: official-doc
- Relevance: Public DOI and scholarly metadata API. Useful for papers, citations, license metadata, retractions, and publication metadata.

### `bib-openalex-api`

- Title: OpenAlex API Overview
- Publisher: OpenAlex
- URL: https://docs.openalex.org/how-to-use-the-api/api-overview
- Evidence level: official-doc
- Relevance: Open catalog API for scholarly works, authors, institutions, sources, topics, and publishers.

### `bib-zotero-api`

- Title: Zotero Web API Documentation
- Publisher: Zotero
- URL: https://www.zotero.org/support/dev/web_api/v3/basics
- Evidence level: official-doc
- Relevance: Optional integration path for users who already curate personal libraries in Zotero.

## Public-Domain Books

### `bib-gutenberg-terms`

- Title: Project Gutenberg Terms of Use
- Publisher: Project Gutenberg
- URL: https://www.gutenberg.org/policy/terms_of_use.html
- Evidence level: official-doc
- Relevance: Governs how Project Gutenberg texts and trademarks can be used. Required before importing or redistributing book content.

## Reader Extraction

### `bib-mozilla-readability`

- Title: Mozilla Readability
- Publisher: Mozilla
- URL: https://github.com/mozilla/readability
- Evidence level: implementation
- Relevance: Mature reader-extraction implementation used as a reference point for readable text extraction, metadata extraction, and readerability detection.

## Execution, Lineage, And API Contracts

### `bib-cloudevents`

- Title: CloudEvents
- Publisher: Cloud Native Computing Foundation
- URL: https://cloudevents.io/
- Evidence level: standard
- Relevance: Useful base shape for graph lifecycle events, intake events, import events, and runner outputs.

### `bib-opentelemetry`

- Title: OpenTelemetry Logs and Semantic Conventions
- Publisher: OpenTelemetry
- URL: https://opentelemetry.io/docs/specs/otel/logs/
- Evidence level: standard
- Relevance: Useful reference for structured logs, run observability, and correlation across importers and graph patches.

### `bib-trace-context`

- Title: Trace Context
- Publisher: W3C
- URL: https://www.w3.org/TR/trace-context/
- Evidence level: standard
- Relevance: Useful for correlating reader events, API calls, importer runs, and downstream graph writes.

### `bib-openlineage`

- Title: OpenLineage Object Model
- Publisher: OpenLineage
- URL: https://openlineage.io/docs/1.37.0/spec/object-model/
- Evidence level: standard
- Relevance: Not a forced model, but a strong reference for dataset, job, run, and facet lineage when designing graph import and migration records.

### `bib-rfc-9457`

- Title: RFC 9457: Problem Details for HTTP APIs
- Publisher: RFC Editor / IETF
- URL: https://www.rfc-editor.org/rfc/rfc9457
- Evidence level: standard
- Relevance: Base format for machine-readable importer, API, migration, and agent failure responses.

### `bib-openapi`

- Title: OpenAPI Specification
- Publisher: OpenAPI Initiative
- URL: https://spec.openapis.org/oas/
- Evidence level: standard
- Relevance: API-first graph and reader endpoints should expose bounded typed surfaces before MCP wrappers or agent tools.

### `bib-mcp`

- Title: Model Context Protocol Specification
- Publisher: Model Context Protocol
- URL: https://modelcontextprotocol.io/specification/2025-06-18/basic
- Evidence level: standard
- Relevance: Useful later for capability negotiation, but should wrap repo-native APIs rather than replace them.

## Relevance, Ranking, And News Triage

### `bib-news-rec-survey-2021`

- Title: News Recommender System: A Review of Recent Progress, Challenges, and Opportunities
- Publisher: Artificial Intelligence Review / PMC
- URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC8294232/
- Evidence level: research-survey
- Relevance: Summarizes news recommendation challenges including cold start, data sparsity, interpretability limits, diversity, novelty, and serendipity. Supports treating reader ranking as multi-objective rather than click prediction.

### `bib-personalized-news-survey-2023`

- Title: A Survey of Personalized News Recommendation
- Publisher: Data Science and Engineering / Springer
- URL: https://link.springer.com/article/10.1007/s41019-023-00228-5
- Evidence level: research-survey
- Relevance: Reviews personalized news recommendation components such as data collection, user modeling, prediction modeling, and personalized display. Useful for separating intake, ranking, and UI queues.

### `bib-mind-news-rec`

- Title: MIND: A Large-scale Dataset for News Recommendation
- Publisher: ACL 2020 / Microsoft Research
- URL: https://www.microsoft.com/en-us/research/publication/mind-a-large-scale-dataset-for-news-recommendation/
- Evidence level: research-dataset
- Relevance: Establishes that news recommendation quality depends on news content understanding and user interest modeling. This project should not claim strong personalization until it has explicit user interest signals and evaluation data.

### `bib-explainable-rec-survey`

- Title: Explainable Recommendation: A Survey and New Perspectives
- Publisher: Foundations and Trends in Information Retrieval / arXiv
- URL: https://arxiv.org/abs/1804.11192
- Evidence level: research-survey
- Relevance: Frames explainable recommendation around what, when, who, where, and why. Supports requiring every ranked work to expose reason codes and evidence refs rather than only a numeric score.

### `bib-beyond-accuracy-rec`

- Title: Beyond-Accuracy: A Review on Diversity, Serendipity, and Fairness in Recommender Systems Based on Graph Neural Networks
- Publisher: Frontiers in Big Data / PMC
- URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC10762851/
- Evidence level: research-survey
- Relevance: Shows that accuracy alone is insufficient for recommendation quality. Supports explicit diversity, novelty, serendipity, and fairness/bias checks before optimizing a single relevance score.

### `bib-editorial-values-news-rec`

- Title: Beyond Optimizing for Clicks: Incorporating Editorial Values in News Recommendation
- Publisher: arXiv
- URL: https://arxiv.org/abs/2004.09980
- Evidence level: research
- Relevance: Studies recommendation against editorial values such as serendipity, dynamism, diversity, and coverage. Supports this repo's plan to rank for user value and public importance, not engagement.

### `bib-news-transparency-control-2024`

- Title: Exploring Users' Desire for Transparency and Control in News Recommender Systems: A Five-Nation Study
- Publisher: Journalism / Sage
- URL: https://journals.sagepub.com/doi/10.1177/14648849231222099
- Evidence level: research
- Relevance: Supports the product requirement that news ranking expose controls and explanations, especially because personalized news can have broader societal implications.

### `bib-tdt-nist`

- Title: Topic Detection and Tracking Evaluation Overview
- Publisher: NIST
- URL: https://www.nist.gov/publications/topic-detection-and-tracking-evaluation-overview
- Evidence level: research-methodology
- Relevance: Defines event-oriented news tasks such as topic tracking, link detection, topic detection, first-story detection, and story segmentation. Useful for distinguishing trending events from duplicate articles.

### `bib-nist-ai-rmf`

- Title: Artificial Intelligence Risk Management Framework (AI RMF 1.0)
- Publisher: NIST
- URL: https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-ai-rmf-10
- Evidence level: standard
- Relevance: Provides risk-management framing for AI systems. Ranking and curation agents should be governed, mapped, measured, and managed before they mutate reader or graph state.

### `bib-reuters-digital-news-report-2024`

- Title: Digital News Report 2024
- Publisher: Reuters Institute for the Study of Journalism
- URL: https://reutersinstitute.politics.ox.ac.uk/digital-news-report/2024
- Evidence level: industry-research
- Relevance: Documents news avoidance, news overload, trust concerns, and platform shifts. Supports building a calmer triage system instead of another high-volume headline feed.

### `bib-trust-project-indicators`

- Title: Trust Indicators Explained
- Publisher: The Trust Project
- URL: https://thetrustproject.org/
- Evidence level: implementation-standard
- Relevance: Provides source transparency dimensions such as ownership, author, method, sourcing, and corrections. Useful as candidate fields for user-owned source assessments, not as an automatic truth label.

## Local Architecture References

These references are local repo artifacts. They are not external truth; they document working patterns already used across Justin's platform and resume systems.

### `local-codex-biblio-execution-observability`

- Title: Execution And Observability Standards
- Repo: `codex_platform`
- Path: `resources/biblio/execution-and-observability-standards.md`
- Evidence level: local-artifact
- Relevance: Local standards pack for CloudEvents, OpenTelemetry, Trace Context, OpenLineage, and worker observability.

### `local-codex-biblio-agent-error-contracts`

- Title: Agent Error Contract Standards
- Repo: `codex_platform`
- Path: `resources/biblio/agent-error-contract-standards.md`
- Evidence level: local-artifact
- Relevance: Local guidance for RFC 9457-style machine-readable errors and markdown renderings of the same problem payload.

### `local-codex-biblio-api-first`

- Title: Token Economy And API-First Execution
- Repo: `codex_platform`
- Path: `resources/biblio/token-economy-and-api-first-execution.md`
- Evidence level: local-artifact
- Relevance: Local guidance to prefer repo-native APIs, bounded schemas, and compact execution surfaces before large tool catalogs.

### `local-researcher-research-workflow`

- Title: Research Workflow
- Repo: `researcher-agent`
- Path: `docs/research-workflow.md`
- Evidence level: local-artifact
- Relevance: Defines the intake, scope, acquire, extract, graph, synthesize, evaluate, and contextualize lifecycle that this repo should mirror.

### `local-researcher-source-provenance`

- Title: Source Provenance
- Repo: `researcher-agent`
- Path: `docs/source-provenance.md`
- Evidence level: local-artifact
- Relevance: Defines source records, locators, verification, source scoring, question ranking, implementation bridge handoffs, and claim graph boundaries.

### `local-researcher-local-orchestration-api`

- Title: Local Orchestration API
- Repo: `researcher-agent`
- Path: `docs/local-orchestration-api.md`
- Evidence level: local-artifact
- Relevance: Defines deterministic command responses, typed evidence refs, finite reason codes, and contract-first local orchestration.

### `local-resume-agent-architecture`

- Title: Resume Agent Architecture
- Repo: `resume-agent`
- Path: `docs/architecture.md`
- Evidence level: local-artifact
- Relevance: Current model for relevance as evidence-backed selection rather than generation or unsupported claims.

### `local-resume-agent-boundary`

- Title: Researcher Agent Boundary
- Repo: `resume-agent`
- Path: `docs/researcher-agent-boundary.md`
- Evidence level: local-artifact
- Relevance: Separates external research context from personal claims; directly relevant to intel graph claim provenance.

### `local-creative-resume-job-workflow`

- Title: Resume Job Application Workflow
- Repo: `creative-resume`
- Path: `docs/resume-job-application-workflow.md`
- Evidence level: local-artifact
- Relevance: Local example of side-effect-free JSON command surfaces, ranked content, source fact ids, claim audit, and human review gates.

## Career And Relevance References

### `bib-career-aware-rag-resume-tailoring`

- Title: Career-Aware Resume Tailoring via Multi-Source Retrieval-Augmented Generation with Provenance Tracking
- Publisher: arXiv
- URL: https://arxiv.org/abs/2605.05257
- Evidence level: research
- Relevance: Emerging reference for career vaults, multi-source retrieval, provenance tracking, confidence scoring, and review loops. Useful as a parallel design pattern for relevance over personal graph data.

### `bib-eeoc-selection-procedures`

- Title: Employment Tests and Selection Procedures
- Publisher: U.S. Equal Employment Opportunity Commission
- URL: https://www.eeoc.gov/laws/guidance/employment-tests-and-selection-procedures
- Evidence level: official-doc
- Relevance: Relevant to later automated job matching and application workflows where ranking and screening can affect employment decisions.

## Research Gaps

- Source quality and bias scoring needs a transparent user-owned model, not a borrowed centralized trust score.
- Copyright and fair-use boundaries need a deeper legal/policy review before storing full article text.
- Browser capture needs a privacy threat model before extension work starts.
- Ranking needs a review of recommender-system transparency and human-in-the-loop curation literature.
- Idempotent graph patching needs a concrete schema before any persistent graph migration is implemented.
