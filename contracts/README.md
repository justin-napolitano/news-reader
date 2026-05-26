# Intel Graph Contracts

These schemas define the first stable object surfaces for the Open Intel Graph.

They are intentionally storage-neutral. The current reader can normalize sources and feed items into these shapes before any database, Jay Life Graph adapter, browser capture tool, or curation agent exists.

## Contract Rules

- All objects carry `schema_version`.
- All persistent or replayable objects need stable ids.
- Graph mutations must go through `graph-patch`.
- Import runs must declare idempotency keys and audit counts.
- Life Graph imports must stay dry-runnable until the LifeDB migration has been reviewed and applied.
- Relevance outputs are advisory unless a separate graph patch applies the result.
- Copyrighted article full text is not persisted by default.

## Schemas

- `source.schema.json`
- `work.schema.json`
- `intake-event.schema.json`
- `annotation.schema.json`
- `topic.schema.json`
- `entity.schema.json`
- `claim.schema.json`
- `project-connection.schema.json`
- `graph-patch.schema.json`
- `import-run.schema.json`
- `intel-graph-lifedb-schema.schema.json`
- `life-graph-import.schema.json`
- `life-graph-migration-manifest.schema.json`
- `relevance-result.schema.json`
