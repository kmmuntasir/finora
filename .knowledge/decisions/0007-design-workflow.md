---
tags: [decision, design, process]
updated: 2026-10-28
status: accepted
---

# 0007 — Design workflow without a designer

## Decision

- The design system is a root `DESIGN.md` in the Google `design.md` format,
  linted for broken references and contrast.
- Key screens are prototyped in two or three variants with real data; the
  owner picks.
- Quality gates use vendored skills: `impeccable`, `emil-design-eng`,
  `mobile-native`, `break-ui`, `review-animations`
  (see `.claude/skills/VENDORED.md`).
- Full plan: [docs/ui-plan.md](../../docs/ui-plan.md). Tool evaluation:
  [design/references.md](../design/references.md).

## Consequences

- Third-party skills are pinned and reviewed, never fetched at run time —
  except the `impeccable` engine binary, which its launcher downloads from
  the project's releases and verifies against pinned SHA-256 digests.
