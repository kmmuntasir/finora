---
tags: [design, research]
updated: 2026-10-28
---

# Design Tools and References

Fourteen repositories from a "ship apps with beautiful UI" list were cloned
(shallow, read-only) and evaluated for Finora on 2026-10-28. Star counts as of
that date.

## Adopt

| Repository | License | What Finora takes from it |
| --- | --- | --- |
| `google-labs-code/design.md` (28.6k★) | Apache-2.0 | The DESIGN.md format: YAML design tokens plus prose rationale, sections Overview → Colors → Typography → Layout → Elevation → Shapes → Components → Do's and Don'ts. Its CLI lints token references and WCAG contrast. Finora's design system is written in this format. |
| `VoltAgent/awesome-design-md` (124k★) | MIT | Reference DESIGN.md files of real products. Relevant: **Spotify** (content-first darkness, artwork as the colour source, single accent, round play controls, persistent player), **Apple** (cinematic restraint), **Linear** and **Raycast** (dense, calm admin surfaces). Used as inspiration, not copied. No Netflix or Plex entry exists. |
| `emilkowalski/skills` (50.6k★) | MIT | Agent skills for interface craft: `emil-design-eng`, `mobile-native` (100vh, tap highlight, safe areas, input zoom), `break-ui` (worst-case data), `review-animations`, `apple-design`, `pick-ui-library`. |
| `pbakaus/impeccable` (90k★) | Apache-2.0 | Design-review skill with commands such as `critique`, `audit`, `polish`, `harden`, `typeset`, and deterministic anti-pattern detectors. Useful as a review gate for a team without a designer. Ships a shell CLI — review before installing. |

## Libraries suggested by `pick-ui-library` that fit Finora

| Need | Library |
| --- | --- |
| Toasts | Sonner |
| Command palette / global search | cmdk |
| Virtualised grids for thousands of items | Virtuoso |
| Enter/exit, layout and gesture animation | Motion (CSS transitions for simple cases) |
| Variant-driven Tailwind classes | cva + clsx |
| Client state (player, queue) | zustand |
| Drag to reorder (play queue, playlists) | dnd kit |

## Skip

| Repository | Reason |
| --- | --- |
| `nextlevelbuilder/ui-ux-pro-max-skill` (141k★) | Generic style generator; its product categories have no media-streaming profile and lean to landing pages. Overlaps with the adopted tools. |
| `Leonxlnx/taste-skill` (104k★), `Nutlope/hallmark` (38.6k★) | Strong, but aimed at websites and landing pages built from a theme catalogue. Finora is an app with its own brand. |
| `nexu-io/open-design` (104k★) | A separate design workspace application; too heavy for this project. |
| `DavidHDev/react-bits` (50k★) | MIT + Commons Clause licence; showy effects that clash with a content-first player UI. |
| `magicuidesign/magicui` (23k★) | Marketing-page effects. Possibly a component or two for a future project website. |
| `greensock/gsap-skills` (17k★) | Finora does not need GSAP. |
| `oso95/scroll-world`, `DavidHDev/canvas-ui`, `enesozturk/dimensional-drawing` | 3D landing pages, WebGL effects, illustrations — not app UI. `dimensional-drawing` could help with README illustrations later. |

## Safety

Third-party agent skills run with the agent's permissions. Before adding one
to `.claude/skills/`, read every file, pin the commit, and vendor it into the
repository rather than installing from the network at run time.
