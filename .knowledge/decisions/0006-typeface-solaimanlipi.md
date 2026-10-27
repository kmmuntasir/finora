---
tags: [decision, design, typography]
updated: 2026-10-28
status: accepted
---

# 0006 — Typeface: SolaimanLipi

## Context

Library titles mix Latin and Bengali script. Separate Latin and Bengali fonts
produce mismatched heights and styles inside one title.

## Decision

Use **SolaimanLipi** for all UI text, chosen by the owner.

- Files: `solaimanlipi-{thin,normal,bold}-v1.0.ttf` from
  [maateen/bangla-web-fonts](https://github.com/maateen/bangla-web-fonts),
  internal version 2.002, weights 100 / 400 / 700.
- Licence (embedded name table): SIL Open Font License 1.1, copyright
  Ekushey. Self-hosting and conversion to WOFF2 are allowed; ship the licence
  text with the fonts and do not sell the fonts on their own.
- Coverage checked with fontTools: Latin and the Bengali block present; no
  Euro sign. 425 glyphs per weight.

## Consequences

- Only three weights; hierarchy relies on 400 vs 700 and size.
- Fallback stack: `SolaimanLipi, system-ui, "Noto Sans Bengali", sans-serif`.
