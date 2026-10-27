# Finora — UI Plan

How Finora's interface is designed and built when the team has no dedicated
designer. Product scope is in [concept.md](concept.md).

## 1. Approach

1. **Write the design system first**, as a root `DESIGN.md` in the
   [google-labs-code/design.md](https://github.com/google-labs-code/design.md)
   format: YAML tokens (colours, typography, spacing, radii, elevation,
   motion) plus prose explaining why. Lint it with
   `npx @google/design.md lint DESIGN.md`, which also checks WCAG contrast.
2. **Generate the Tailwind theme from the tokens** as CSS custom properties,
   so dark and light themes share semantic names.
3. **Prototype key screens with real data**, two or three variants each,
   switchable on the page. The owner picks; nobody has to draw mock-ups.
4. **Build the chosen variants** as production components.
5. **Run quality gates** before a screen counts as done (section 6).

## 2. Visual direction

**Cinematic, content-first dark.** The interface recedes; posters and
backdrops supply the colour.

- Near-black neutral surfaces in a few elevation steps.
- **Finora blue** is the single interactive accent.
- The logo gradient (cyan → blue → indigo) appears only on the primary Play
  button and on progress bars, so it stays special.
- Round play controls; generous artwork; restrained motion.
- The admin console uses the same tokens with denser, calmer layouts and
  readable tables.

References (inspiration, not copies) from
[awesome-design-md](https://github.com/VoltAgent/awesome-design-md):

| Reference | What to learn |
| --- | --- |
| Spotify | Content-first darkness, artwork as colour source, persistent player bar, round controls |
| Apple | Cinematic detail pages, typographic restraint |
| Linear, Raycast | Dense, calm admin surfaces |

## 3. Typography

- **SolaimanLipi** for all UI text: Thin 100, Regular 400, Bold 700
  (version 2.002, SIL OFL 1.1, from
  [maateen/bangla-web-fonts](https://github.com/maateen/bangla-web-fonts)).
- Self-hosted as WOFF2 with the licence file next to the fonts.
- One family for Latin and Bengali keeps mixed titles (for example
  `Bangla Natok অতিথী _OTITHII 1998`) on a single baseline and style.
- Fallback stack: `SolaimanLipi, system-ui, "Noto Sans Bengali", sans-serif`.
- A defined type scale in `DESIGN.md`; hierarchy comes mostly from weight
  (400 / 700) and size, not from many families.

## 4. Layout

| Area | Desktop | Phone |
| --- | --- | --- |
| Navigation | Left sidebar: Home, Search, each library, Favourites, Admin | Bottom tab bar; libraries in a sheet |
| Search | ⌘K / Ctrl+K palette plus a search page | Full-screen search page |
| Home | Horizontal rows of posters and thumbnails | Same rows, swipeable |
| Library | Virtualised poster grid, filter bar, A–Z rail | Two-column grid, filters in a bottom sheet |
| Detail page | Full-bleed backdrop, title logo, actions, metadata, seasons/episodes, cast | Backdrop header, stacked sections |
| Player | Full-screen with auto-hiding controls | Same, touch-sized controls, gestures |
| Music | Persistent now-playing bar at the bottom; full now-playing view | Mini bar above the tab bar; full-screen sheet |
| Admin | Sidebar section with tables and side panels | Lists with detail pages |

## 5. Data-driven details

From the reference server:

- **Bengali text in titles** — covered by SolaimanLipi; also test long mixed
  titles for truncation and line clamping.
- **Home Videos often lack posters** — use 16:9 thumbnail cards and a designed
  placeholder built from the logo's jellyfish negative-space motif and the
  item title. Never invent artwork.
- **Large libraries (~4,200 movies)** — virtualised grids, small artwork sizes
  requested from Jellyfin, skeleton loading.
- **Heavy music use** — the persistent player and queue are first-class, not
  an afterthought.

## 6. Component foundations

| Need | Library |
| --- | --- |
| Accessible primitives (dialog, menu, popover, select, tabs) | Radix UI |
| Toasts | Sonner |
| Bottom sheets on phones | Vaul |
| Command palette | cmdk |
| Virtualised grids and lists | Virtuoso |
| Animation | Motion; CSS transitions for simple cases |
| Player and queue state | zustand |
| Drag to reorder | dnd kit |
| Variant styling | cva + clsx |
| Icons | Lucide |

## 7. Quality gates

A screen is done when:

- `DESIGN.md` lint passes and new tokens are documented there.
- The `impeccable` skill's `audit` and `critique` find no unresolved issues.
- `break-ui` worst-case data (long Bengali titles, missing artwork, empty
  lists, huge counts) renders acceptably.
- `mobile-native` concerns are handled (safe areas, `100dvh`, tap highlight,
  input zoom).
- Animations pass `review-animations`.
- Screenshots at phone (390 px), tablet (820 px) and desktop (1440 px) widths
  look right in dark and light themes.
- Keyboard navigation and visible focus work; reduced motion is respected.

Vendored skills are listed in
[.claude/skills/VENDORED.md](../.claude/skills/VENDORED.md).

## 8. Prototype round

Screens prototyped first, in this order:

1. Home
2. Library grid
3. Movie and series detail
4. Player controls
5. Music now-playing bar and full view
6. Admin user list and user editor

For each: two or three variants behind a switcher, real data from the
reference server, screenshots at the three widths. The owner chooses; the
choice and its reasons are recorded in `.knowledge/`.
