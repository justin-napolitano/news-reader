# Local Resource Review

Status: draft
Updated: 2026-05-26

This review records the local repo resources pulled into the Open Intel Graph planning layer before implementation starts.

## Reviewed Sources

| Local Ref | Repo | Path | Imported Guidance |
| --- | --- | --- | --- |
| `local-codex-biblio-execution-observability` | `codex_platform` | `resources/biblio/execution-and-observability-standards.md` | Use CloudEvents, OpenTelemetry, Trace Context, and OpenLineage as references for run/event/lineage contracts. |
| `local-codex-biblio-agent-error-contracts` | `codex_platform` | `resources/biblio/agent-error-contract-standards.md` | Use RFC 9457-style problem objects for machine-readable failures. |
| `local-codex-biblio-api-first` | `codex_platform` | `resources/biblio/token-economy-and-api-first-execution.md` | Prefer compact repo-native APIs and bounded schemas before MCP wrappers or broad tool catalogs. |
| `local-researcher-research-workflow` | `researcher-agent` | `docs/research-workflow.md` | Keep the research loop explicit: intake, scope, acquire, extract, graph, synthesize, evaluate, contextualize. |
| `local-researcher-source-provenance` | `researcher-agent` | `docs/source-provenance.md` | Separate source records, locators, verification, source scoring, claim graph state, and implementation handoffs. |
| `local-researcher-local-orchestration-api` | `researcher-agent` | `docs/local-orchestration-api.md` | Use deterministic responses, typed evidence refs, finite reason codes, and contract-first orchestration. |
| `local-resume-agent-architecture` | `resume-agent` | `docs/architecture.md` | Treat relevance as evidence-backed selection over canonical facts, not generation. |
| `local-resume-agent-boundary` | `resume-agent` | `docs/researcher-agent-boundary.md` | Do not convert external research context into a personal claim unless it maps to canonical evidence. |
| `local-creative-resume-job-workflow` | `creative-resume` | `docs/resume-job-application-workflow.md` | Preserve source fact ids, side-effect-free previews, claim audit, and human review before downstream action. |

## Imported Requirements

- Exec plans need claim ledgers.
- Graph mutations need idempotency keys, dry-run behavior, audit output, and replay semantics.
- Relevance/ranking outputs need reason codes, evidence refs, missing evidence, and deterministic tie breakers.
- Research artifacts should distinguish source-backed claims, local artifact claims, implementation observations, design assumptions, and open questions.
- Agentic workflows should be advisory until a separate graph patch or human-approved mutation is applied.

## Not Imported Yet

- Full research-agent source acquisition schemas.
- Full remaining-work graph governance.
- Job-market trend-pack source vocabulary.
- Resume writer/export governance.
- Legal policy for storing copyrighted full text.

Those should become later research or implementation nodes only if the intel graph needs them.

