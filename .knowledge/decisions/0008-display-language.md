---
tags: [decision, i18n]
updated: 2026-10-28
status: accepted
---

# 0008 — Display language: formats now, translation later

## Context

Tier 2 lists "display language and date format". Finora's text is written
directly in English in the components; translating it means routing every
string through a message catalogue and supplying a reviewed translation.
The owner's household reads both English and Bengali, and the typeface
(decision 0006) already covers both scripts.

## Decision

- Ship the date and number format now. Settings → Appearance offers a
  locale ("Same as this browser", English variants, বাংলা, and a few others).
  Dates and numbers go through `formatDate` and `formatNumber` in
  `web/src/lib/format.ts`. The choice is a server-synced Finora preference.
- Do not ship a partial or machine-made Bengali interface. Interface
  translation moves to Tier 3. It needs a message catalogue, extraction of
  every string, and a translation reviewed by a native speaker.
- Relative times ("3 hours ago") stay in the browser's language. Mixing a
  Bengali phrase into English sentences reads worse than either language.

## Consequences

- The Settings hint says that Finora's text is in English for now.
- When translation starts, `dateLocale` can become the display language as
  well, or a second preference can be added beside it.
