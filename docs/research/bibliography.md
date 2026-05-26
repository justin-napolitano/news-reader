# Initial Bibliography

Status: draft
Updated: 2026-05-26

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

## Research Gaps

- Source quality and bias scoring needs a transparent user-owned model, not a borrowed centralized trust score.
- Copyright and fair-use boundaries need a deeper legal/policy review before storing full article text.
- Browser capture needs a privacy threat model before extension work starts.
- Ranking needs a review of recommender-system transparency and human-in-the-loop curation literature.

