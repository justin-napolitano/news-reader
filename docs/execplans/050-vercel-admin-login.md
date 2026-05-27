# Vercel Admin Login

ID: `ig-050-vercel-admin-login`
Status: `implemented`
Scope owner: `news-reader`

## Intent

Deploy News Reader as a private Vercel site at `news.selectproj.com` with a simple admin passcode gate.

## Research Lock

| Claim | Class | References | Implementation consequence |
| --- | --- | --- | --- |
| The reader is private intel, not a public publishing surface. | project_assumption | `docs/project-intent.md`, `docs/schema/intel-graph-lifedb.md` | Gate reader pages and API routes behind login. |
| Repo secrets must stay in env/config, not source files. | local_artifact_backed | `.env.example`, `docs/research/research-quality-gates.md` | Store passcode and session secret in Vercel/env variables only. |
| Vercel needs a serverless entrypoint rather than only a long-running local listener. | implementation_observation | `server.js`, `api/index.js`, `vercel.json` | Export the existing handler and route Vercel traffic through `api/index.js`. |

## Scope In

- Export the existing HTTP handler for Vercel.
- Add a Vercel entrypoint and route config.
- Add `/login` and `/logout`.
- Require username `admin` by default.
- Read the passcode from `NEWS_READER_ADMIN_PASSCODE`.
- Store login state in a signed HttpOnly cookie.
- Keep `/api/health` public for deployment checks.
- Update docs, env example, and smoke tests.

## Scope Out

- Multi-user accounts.
- Password reset.
- Database-backed sessions.
- OAuth.
- Vercel project creation or DNS mutation from this repo.

## Mutation Policy

Login only sets or clears the `news_reader_session` cookie. It does not write to Life Graph or local files.

## Idempotency

The Vercel config is static. Repeated login attempts either mint a new signed session cookie or return a login error.

## Validation

- `node --check server.js`
- `node --check api/index.js`
- `npm run contracts`
- `npm run smoke`
- `git diff --check`

## Handoff

After merge, configure Vercel env vars, attach `news.selectproj.com`, and deploy from `main`.
