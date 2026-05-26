# Research Quality Gates

Status: draft
Updated: 2026-05-26

This project should not move from idea to implementation through unstated assumptions. Every build node should explain what claim it depends on, where that claim came from, and what will be true after the node lands.

## Claim Classes

Every non-trivial claim in a research note, contract, or exec plan must fit one class:

- `bibliography_backed`: supported by a standards, official-doc, research, or implementation source in `docs/research/bibliography.md`.
- `local_artifact_backed`: supported by an existing repo artifact, local API behavior, schema, code path, or committed planning doc.
- `implementation_observation`: observed directly in the current codebase during this slice.
- `project_assumption`: a chosen design assumption that is not externally proven.
- `open_question`: intentionally unresolved and blocked from implementation until answered or scoped out.

Any claim that cannot fit one of those classes should not appear in an exec plan as a reason to build.

## Required Claim Ledger

Every future exec plan should include a claim ledger with this shape:

| Claim | Class | Evidence Ref | Why It Matters | Build Consequence |
| --- | --- | --- | --- | --- |
| Concise claim | bibliography_backed | `bib-web-annotation` | Connects annotation storage to a standard | Add annotation fields matching the model |

Evidence refs may point to:

- bibliography ids such as `bib-web-annotation`
- local source ids such as `local-researcher-source-provenance`
- repo paths such as `server.js`
- validation commands such as `npm run smoke`
- generated artifacts such as `artifacts/.../review-packet.json`

## Idempotent Graph Patch Requirements

Graph writes must be repeatable. Replaying the same migration, import, or patch should produce the same graph state or a clear `already_applied` result.

Every graph migration or patch node must define:

- stable object ids or deterministic natural keys
- schema version
- migration id
- idempotency key or payload hash
- dry-run behavior
- apply behavior
- preconditions
- postconditions
- duplicate handling
- conflict handling
- rollback or restore strategy
- audit event output
- validation command

Default mutation rule:

- inserts should be upserts when the object identity is stable
- destructive changes require backup, explicit review, and a reversible plan
- patch application must emit a machine-readable summary of created, updated, skipped, and blocked objects
- migrations must not silently infer facts that are not present in the patch payload or source record

## Relevance And Ranking Requirements

Ranking is not authority. It is a projection over evidence.

Any future relevance scorer, ranking algorithm, recommendation queue, source-quality score, or curation agent must return:

- input query or user intent
- algorithm id and version
- candidate set id
- score
- reason codes
- matched evidence refs
- missing evidence refs
- deterministic tie breaker
- confidence or uncertainty note
- whether the result is advisory or allowed to mutate state

The resume system is the current local model: it ranks existing facts against a job posting, preserves source fact ids, exposes gaps, and blocks downstream writing from inventing claims.

The intel graph should follow the same posture. A ranked work, source, topic, or project connection should explain why it surfaced and which graph edges or source records support it.

## Migration Review Gate

Before any persistent graph migration lands, reviewers should be able to answer:

- What source or artifact justifies this schema?
- What objects can this migration create?
- Can the migration be replayed safely?
- What happens if the same source item appears twice?
- What happens if a source changes title, URL, feed guid, DOI, ISBN, or canonical URL?
- Which fields are authoritative and which are projections?
- Which fields are user-authored versus agent-inferred?
- How can the user inspect and correct the result?

If those questions are not answerable from the exec plan, the implementation is not scoped tightly enough.
