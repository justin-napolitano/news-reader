# Exec Plans

Exec plans turn research-backed scope into buildable work.

Each node should be small enough to implement, review, and merge independently. Larger initiatives should be represented as a DAG of nodes rather than one massive plan.

## Plan Format

Each exec plan should include:

- `id`: stable node id
- `title`: human-readable title
- `status`: proposed, active, blocked, done, or superseded
- `research_questions`: research ids that justify this node
- `depends_on`: node ids that must land first
- `scope_in`: exact included work
- `scope_out`: explicit exclusions
- `contracts`: JSON schemas or data contracts touched
- `claim_ledger`: claims, evidence refs, and build consequences
- `mutation_policy`: whether the node is read-only, dry-run, or state-mutating
- `idempotency`: replay behavior for any importer, migration, graph patch, or API write
- `implementation`: expected files or modules
- `validation`: commands, manual checks, and review gates
- `stop_conditions`: conditions that require stopping instead of guessing
- `handoff`: what the next node can assume

## Node Rules

- One node should produce one coherent system improvement.
- A node may add docs, contracts, code, or tests, but the validation path must be clear.
- If a node discovers new scope, it should register a follow-up node instead of expanding silently.
- Any source-ingestion node must cite the relevant bibliography entry and state the content storage policy.
- Any agentic node must declare which actions are advisory and which actions can mutate the graph.
- Any relevance, ranking, or recommendation node must expose scores, reason codes, evidence refs, missing evidence, and deterministic tie breakers.
- Any migration or patch node must be idempotent, auditable, and dry-runnable.
- Any open question must block the affected implementation path or be explicitly scoped out.

## Evidence Rule

Exec plans are not allowed to use broad claims like "best practice", "good UX", "better ranking", "more scalable", or "agentic" unless the plan ties the claim to one of:

- a bibliography id
- a local artifact id
- a direct code observation
- an explicit project assumption

The required standard is research quality, not marketing plausibility.
