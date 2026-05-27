# Vercel Ops Manifest

ID: `ig-060-vercel-ops-manifest`
Status: `implemented`
Scope owner: `news-reader`

## Intent

Make Vercel deployment requirements shell-operable from repo contracts so the site can be configured without clicking
through the Vercel UI.

## Research Lock

| Claim | Class | References | Implementation consequence |
| --- | --- | --- | --- |
| Secrets should not be hard-coded into repo artifacts. | local_artifact_backed | `.env.example`, `docs/research/research-quality-gates.md` | The manifest stores key names and defaults only; values come from env or untracked files. |
| Deployment configuration should be replayable and auditable. | local_artifact_backed | `docs/execplans/README.md`, `docs/execplans/050-vercel-admin-login.md` | Vercel env/domain operations are represented as a JSON manifest plus dry-run-first scripts. |
| The reader must be deployable at `news.selectproj.com`. | project_assumption | `README.md`, `vercel.json` | Domain attachment is a named repo command, not a manual-only GUI action. |

## Scope In

- Add `ops/vercel/news-reader.manifest.json`.
- Add dry-run-first env sync script.
- Add dry-run-first domain attachment script.
- Add npm scripts for plan/push/pull/domain operations.
- Ignore untracked `.env.*` files while preserving `.env.example`.
- Document the shell workflow.

## Scope Out

- Running Vercel mutations during implementation.
- Storing secret values in git.
- Creating or linking the Vercel project automatically.
- DNS provider automation.

## Mutation Policy

`vercel:env:plan` and `vercel:domain:plan` are read-only. `vercel:env:push` and `vercel:domain:add` mutate Vercel through
the Vercel REST API and require `VERCEL_TOKEN`.

## Idempotency

Env pushes call the Vercel project env endpoint with `upsert=true`, so repeated runs update the same key/target pair. Domain
attach checks whether the domain is already on the project before creating it.

## Validation

- `node --check scripts/vercel-sync-env.mjs`
- `node --check scripts/vercel-add-domain.mjs`
- `npm run vercel:env:plan`
- `npm run vercel:domain:plan`
- `npm run smoke`
- `git diff --check`

## Handoff

After merge, create `.env.vercel.production`, run `npm run vercel:env:push`, then run `npm run vercel:domain:add`.
