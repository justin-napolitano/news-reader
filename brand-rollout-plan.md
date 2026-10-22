# News Reader unified brand rollout

Status: draft; user authorized swarm implementation and deployment on 2026-10-22.

Issue: https://github.com/justin-napolitano/news-reader/issues/17

## Context and scope

Apply the approved Index / Simplified board without title marks. Preserve reader, source manager, review gestures, article extraction, save/read/archive state, authentication, sessions and scheduled imports. Work in an isolated checkout from remote main; do not overwrite the original checkout's unrelated server, home and reader changes. Existing deployed target is `news.selectproj.com` on the News Reader Vercel project.

## Plan of work

1. Apply shared paper/ink/stone and very limited slate tokens; modest sans UI title, restrained serif reading headings, compact navigation and light rules. Remove the oversized display type and decorative elevated cards without changing the app's interactions.
2. Self-host licensed fonts and serve their static MIME types correctly. Preserve login/access control for static assets and reader APIs. Keep source attribution, article imagery and meaningful state feedback.
3. Run existing contract and smoke tests; inspect focused routes and font responses with a safe local fixture/auth context. Keep original public/private behavior and production import schedules.
4. Capture desktop/mobile/review/login examples, compare them with the exact approved reference, and resolve visual issues before promotion.
5. Commit and publish a scoped PR. Build a staging deployment using existing project configuration without assigning production domains; after checks, promote the verified deployment and record rollback and smoke evidence.

## Validation and acceptance

`npm run contracts` and `npm run smoke`, plus responsive reflow, visible keyboard focus, meaningful state colors and no giant headings or title marks. Review screen remains a usable swipe/card workflow; typography is simplified without removing functional grouping. No production API writes/imports are part of visual tests. Browser fallback permission is pending; rendered QA cannot be marked passed until authorized capture is inspected.

## Recovery

Revert the presentation-only commit or restore the previous recorded Vercel deployment. No data migration, source configuration, credential or DNS change is included.
