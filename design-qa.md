# News Reader design QA

Source: approved Index / Simplified board without title marks, `08-index-simplified-no-marks.png`, pinned in littlelink PR #30.

Implementation: local fixture preview on port 4351. Intended captures: 390x844, 768x1024 and 1440x1024 at deviceScaleFactor 1. The board supplies a shared presentation system; preserve the real reader, source manager and review interaction instead of copying a static directory.

Contract and smoke checks pass (14 contract schemas and authenticated reader/login/cron/source/state boundary checks). Styling uses licensed local fonts, warm paper/ink/stone, small slate accents, modest headings and flat functional surfaces. Login HTML is restyled without changing authentication behavior; static TTF MIME is declared. Production imports and credentials are not used in local review.

Rendered screenshots, focused source/implementation comparison, 320px overflow, keyboard/zoom, review gestures and console inspection await explicit browser fallback permission. No visual pass is claimed from code or build checks.

final result: blocked
