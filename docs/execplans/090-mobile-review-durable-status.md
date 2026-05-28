# 090 Mobile Review Deck And Durable Refresh Status

## Intent

Make News Reader usable as a low-friction mobile review surface while keeping the existing list reader intact. The reader should support fast save/archive decisions, short paragraph-by-paragraph skimming, and durable admin visibility into the latest import run.

## Evidence And Constraints

- Existing reader state API: `POST /api/life-graph/intel/reader/state` already supports `save`, `dismiss`, `restore`, and `unsave`.
- Existing article text API: `GET /api/read?url=...` extracts readable text on demand and does not persist article copies.
- Existing feed API: `GET /api/items?view=unread` returns the unread inbox and already falls back safely when Life Graph is unavailable.
- Existing Life Graph schema: `intel_graph.import_runs` is the durable import audit table written by the News Reader apply endpoint.
- Project copyright policy: keep full-text extraction session/local only; do not add durable full-text storage in this slice.

## Scope

### Node `nr-090a-life-graph-import-status`

Repo: `jnap-life-graph`

Deliverables:

- Add `GET /api/intel/imports/news-reader/latest`.
- Return the latest `intel_graph.import_runs` row for importer `news-reader.feed-index`.
- Require the same admin cookie or write-token auth as other Intel Graph endpoints.
- Add docs and a database-missing unit test.

Validation:

- Targeted unit test for database guard.
- Existing import dry-run test still passes.

### Node `nr-090b-news-reader-durable-admin-status`

Repo: `news-reader`

Deliverables:

- Extend the Life Graph client with the latest-import endpoint.
- Make `/api/admin/refresh/status` include durable Life Graph import status when `NEWS_READER_ITEMS_SOURCE=life_graph`.
- Keep the existing in-process status as a fallback for local/feed mode.
- Render durable status in the admin refresh panel.

Validation:

- `npm run smoke`
- Production smoke after deploy.

### Node `nr-090c-mobile-review-deck`

Repo: `news-reader`

Deliverables:

- Add `/review` and `/review.html`.
- Load unread articles from `GET /api/items?view=unread`.
- Swipe right or press right arrow to save.
- Swipe left or press left arrow to archive/dismiss.
- Swipe up, press space/up arrow, or tap the paragraph area to fetch/read one paragraph chunk at a time.
- Provide visible buttons for save, archive, read chunk, and undo.
- Keep the normal list reader unchanged.

Validation:

- `npm run smoke`
- Manual mobile check: load `/review`, swipe left/right, read chunks, undo one action.

## Out Of Scope

- No new durable full-text storage.
- No LLM ranking or extraction changes.
- No replacement of the existing list reader.
- No algorithmic feed personalization beyond the current unread ordering.

## Stop Conditions

- Life Graph latest import status cannot be read idempotently from existing import rows.
- Review actions require a new reader-state migration.
- The mobile deck breaks the existing list reader, reader page, or admin source manager smoke coverage.
