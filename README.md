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
