# News Reader

A small local news reader for high-quality sources without ad-heavy article pages.

The app indexes configured RSS/Atom feeds, shows a clean feed, and extracts readable article text on demand. It keeps the
original source URL visible and does not persist extracted article copies.

## Direction

This repo is the first reader/client for the Open Intel Graph: a user-owned intake graph for sources, works, reading events,
annotations, and project connections.

Start with [Project Intent](docs/project-intent.md), then use the [research system](docs/research/README.md), [bibliography](docs/research/bibliography.md), and [exec plans](docs/execplans/README.md) to plan implementation slices.

## Run

```bash
npm run dev
```

Open `http://localhost:4175`.

## Sources

Edit `data/sources.json`.

Each source needs:

- `id`: stable machine id
- `name`: display name
- `section`: rough grouping
- `feedUrl`: RSS or Atom feed
- `allowHosts`: domains allowed for on-demand reader extraction

AP was not seeded because `https://apnews.com/index.rss` returned `401` during setup from this machine.

## Intel Graph

This repo now exposes read-only normalized graph objects:

- `GET /api/graph/sources`
- `GET /api/graph/contracts`
- `GET /api/graph/works`
- `GET /api/life-graph/migrations`
- `GET /api/life-graph/status`
- `POST /api/life-graph/import/dry-run`
- `POST /api/life-graph/import/remote-dry-run`
- `POST /api/life-graph/import/apply`
- `GET /api/life-graph/intel/sources`
- `GET /api/life-graph/intel/works`

Contracts live in `contracts/`. Fixtures live in `test/fixtures/intel-graph/`.

The Life Graph adapter is intentionally dry-run first. Raw intel is modeled in a proposed LifeDB `intel_graph` schema, while
selected records can later be promoted into Life Graph `life_object` records and `derived_from_source` edges. See
`docs/schema/intel-graph-lifedb.md`.

Proposed LifeDB migrations live in `integrations/life-graph/migrations/`. They are review artifacts for
`jnap-life-graph`; copy or vendor them there only after reviewing the migration manifest.

After the Life Graph migration/API is available, this repo can call it directly. Configure secrets in `.env`, not in repo files:

```bash
LIFE_GRAPH_API_BASE_URL=http://127.0.0.1:8787
LIFE_GRAPH_WRITE_TOKEN=...
NEWS_READER_ITEMS_SOURCE=life_graph
```

The reader UI defaults to feed mode. Set `NEWS_READER_ITEMS_SOURCE=life_graph` to read article cards from
`jnap-life-graph` with feed fallback for local development.

With the local reader server running:

```bash
npm run life-graph:status
npm run life-graph:dry-run
npm run life-graph:push-dry-run
npm run life-graph:apply
npm run life-graph:sources
npm run life-graph:works
```

Run contract validation with:

```bash
npm run contracts
```

## Reader Rules

- Feed index comes from RSS/Atom.
- Article text is extracted only when you click a story.
- Extracted text is cached in memory for a short local session.
- Original source links stay visible.
- This is a personal reader, not a republishing surface.

## Checks

```bash
npm run smoke
```
