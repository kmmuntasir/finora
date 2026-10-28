---
tags: [decision, i18n]
updated: 2026-10-29
status: accepted
supersedes: 0008
---

# 0009 — Ship the interface translation with a Bengali draft

## Context

Decision 0008 shipped date and number formats but held back interface
translation until a native speaker could review it. The owner, a native
Bengali speaker, has since asked for the translation to be built now and
will review the Bengali text afterwards.

## Decision

- Every user-visible string in Finora Web goes through `t()`, `tn()` or
  `msg()` from `web/src/i18n` (see [the i18n note](../web/i18n.md)).
- English is the source and the key. Catalogues for other languages are
  JSON files per feature area, loaded only when that language is chosen.
- Bengali ships as a draft: the language list shows "বাংলা (খসড়া)" and the
  settings hint says it is still being reviewed. Once the owner has reviewed
  it, the "(খসড়া)" label goes.
- `pnpm i18n:check` (part of `pnpm check`) fails when a string has no
  Bengali entry, so new text can't silently stay English.

## Consequences

- Decision 0008's "no partial or machine-made Bengali interface" no longer
  holds for the draft period; the draft label keeps that honest.
- Changing the language remounts the routes, which stops music; it's a rare
  action, and the simpler design avoids threading a language context
  through every component.
- Contributors add a Bengali entry with every new string, or leave it for a
  native speaker and let the check point it out.
