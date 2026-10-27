---
version: alpha
name: Finora
description: Cinematic, content-first dark interface for a self-hosted Jellyfin library. Artwork supplies the colour; Finora blue is the single interactive accent.
colors:
  primary: "#2A66E8"
  primary-hover: "#2259D6"
  primary-pressed: "#1C4CBB"
  on-primary: "#FFFFFF"
  brand-cyan: "#03C1FD"
  brand-blue: "#105FF0"
  brand-indigo: "#1A20BF"
  brand-navy: "#032553"
  background: "#090C12"
  surface: "#10141D"
  surface-raised: "#171D29"
  surface-overlay: "#1F2735"
  border: "#2A3446"
  border-strong: "#56637D"
  on-surface: "#F2F5FA"
  on-surface-muted: "#A8B3C7"
  on-surface-subtle: "#8A96AC"
  focus: "#7FB0FF"
  success: "#34C98B"
  warning: "#F4BA4A"
  error: "#F26D6D"
  scrim: "#05070BCC"
  light-primary: "#1A5CE0"
  light-primary-hover: "#1550C4"
  light-primary-pressed: "#11429F"
  light-on-primary: "#FFFFFF"
  light-background: "#F5F7FB"
  light-surface: "#FFFFFF"
  light-surface-raised: "#EEF2F7"
  light-surface-overlay: "#E4E9F1"
  light-border: "#DAE0EA"
  light-border-strong: "#B9C3D3"
  light-on-surface: "#0B1426"
  light-on-surface-muted: "#475266"
  light-on-surface-subtle: "#566174"
  light-focus: "#1A5CE0"
  light-success: "#127A49"
  light-warning: "#9A6200"
  light-error: "#C42F2F"
  light-scrim: "#0B142699"
typography:
  display:
    fontFamily: SolaimanLipi
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: SolaimanLipi
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.2
  headline-md:
    fontFamily: SolaimanLipi
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: SolaimanLipi
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.35
  body-lg:
    fontFamily: SolaimanLipi
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.6
  body-md:
    fontFamily: SolaimanLipi
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: SolaimanLipi
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label-md:
    fontFamily: SolaimanLipi
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1.3
  label-sm:
    fontFamily: SolaimanLipi
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 0.02em
  caption:
    fontFamily: SolaimanLipi
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
rounded:
  none: 0px
  sm: 6px
  md: 10px
  lg: 14px
  xl: 20px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px
  4xl: 64px
  gutter: 16px
  page-x: 32px
  page-x-mobile: 16px
  sidebar: 248px
  player-bar: 72px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 12px 20px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: 12px 20px
  card-poster:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 10px 14px
  page:
    backgroundColor: "{colors.background}"
    textColor: "{colors.on-surface}"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
  meta-text:
    backgroundColor: "{colors.background}"
    textColor: "{colors.on-surface-muted}"
  light-page:
    backgroundColor: "{colors.light-background}"
    textColor: "{colors.light-on-surface}"
  light-meta-text:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-on-surface-muted}"
  light-button-primary:
    backgroundColor: "{colors.light-primary}"
    textColor: "{colors.light-on-primary}"
  light-button-primary-hover:
    backgroundColor: "{colors.light-primary-hover}"
    textColor: "{colors.light-on-primary}"
  light-button-primary-pressed:
    backgroundColor: "{colors.light-primary-pressed}"
    textColor: "{colors.light-on-primary}"
  light-panel:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-on-surface}"
  light-raised-subtle-text:
    backgroundColor: "{colors.light-surface-raised}"
    textColor: "{colors.light-on-surface-subtle}"
  light-overlay-text:
    backgroundColor: "{colors.light-surface-overlay}"
    textColor: "{colors.light-on-surface}"
  light-input:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-on-surface}"
  light-input-border:
    backgroundColor: "{colors.light-border-strong}"
  light-divider:
    backgroundColor: "{colors.light-border}"
  light-focus-ring:
    backgroundColor: "{colors.light-background}"
    textColor: "{colors.light-focus}"
  light-status-success:
    backgroundColor: "{colors.light-background}"
    textColor: "{colors.light-success}"
  light-status-warning:
    backgroundColor: "{colors.light-background}"
    textColor: "{colors.light-warning}"
  light-status-error:
    backgroundColor: "{colors.light-background}"
    textColor: "{colors.light-error}"
  light-scrim:
    backgroundColor: "{colors.light-scrim}"
  button-primary-pressed:
    backgroundColor: "{colors.primary-pressed}"
    textColor: "{colors.on-primary}"
  play-button:
    backgroundColor: "{colors.brand-blue}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
  progress-track:
    backgroundColor: "{colors.brand-indigo}"
  progress-highlight:
    backgroundColor: "{colors.brand-cyan}"
  wordmark:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.brand-navy}"
  overlay-subtle-text:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.on-surface-subtle}"
  overlay-muted-text:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.on-surface-muted}"
  divider:
    backgroundColor: "{colors.border}"
  input-border:
    backgroundColor: "{colors.border-strong}"
  focus-ring:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.focus}"
  status-success:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.success}"
  status-warning:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.warning}"
  status-error:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.error}"
  dialog-scrim:
    backgroundColor: "{colors.scrim}"
---

# Finora Design System

## Overview

Finora is a home cinema in a browser. The interface recedes into deep,
slightly blue-tinted darkness so that posters, backdrops and album art supply
the colour. Everything else is calm, legible and predictable.

- **Content first.** Artwork is the hero; chrome is quiet.
- **One accent.** Finora blue marks what is interactive and what is active.
- **The logo gradient is special.** Cyan → blue → indigo appears only on the
  primary Play action and on playback progress, never as decoration.
- **Two densities.** Browsing is spacious and cinematic; settings and the
  admin console are compact and tabular.
- **Bilingual by default.** Latin and Bengali share one typeface and one
  baseline.

Dark is the default theme. A light theme uses the `light-*` tokens with the
same roles.

## Colors

- **Background (#090C12):** the page, near-black with a cold blue cast taken
  from the brand navy.
- **Surface (#10141D), Surface Raised (#171D29), Surface Overlay (#1F2735):**
  three tonal steps for panels, cards and menus. Higher elements are lighter.
- **Primary (#2A66E8):** Finora blue, a slightly lighter cousin of the logo
  blue so white text on it stays readable. Buttons, links, active navigation,
  selection, focus companions.
- **Brand Cyan (#03C1FD) → Brand Blue (#105FF0) → Brand Indigo (#1A20BF):**
  the logo gradient. Only for the primary Play button and progress bars.
- **Brand Navy (#032553):** the wordmark colour on light backgrounds.
- **On Surface (#F2F5FA), Muted (#A8B3C7), Subtle (#8A96AC):** primary text,
  metadata, and de-emphasised hints. Muted text must stay readable on every
  surface step.
- **Focus (#7FB0FF):** focus rings, always visible against dark surfaces.
- **Success, Warning, Error:** status only, never decoration.
- **Scrim:** dark translucent overlay behind dialogs and over backdrops so
  text on artwork stays readable.

## Typography

**SolaimanLipi** sets every word in Finora, in Latin and Bengali alike, so
mixed titles such as `Bangla Natok অতিথী _OTITHII 1998` keep one baseline and
one voice. The family has three weights: Thin (100), Regular (400) and Bold
(700).

- **Display and headlines** use Bold. Hierarchy comes from size and weight,
  not from extra families.
- **Body** uses Regular at 16px with generous line height; Bengali conjuncts
  need the room.
- **Labels** use Bold at small sizes for buttons, tabs and badges.
- **Thin** is reserved for very large numerals or decorative headings, never
  for running text.
- Fallback stack: `SolaimanLipi, system-ui, "Noto Sans Bengali", sans-serif`.

## Layout

A 4px base grid. Pages use 32px side margins on desktop and 16px on phones.
In code, the `xs`–`4xl` spacing steps map to Tailwind's numeric scale
(`xs` = 1, `sm` = 2, `md` = 3, `lg` = 4, `xl` = 6, `2xl` = 8, `3xl` = 12,
`4xl` = 16); semantic tokens such as `page-x` and `sidebar` keep their names.

- **Desktop:** fixed 248px sidebar, content area with horizontal rows of
  artwork, persistent 72px player bar at the bottom when something is
  playing.
- **Phone:** bottom tab bar, mini player above it, sheets instead of side
  panels.
- **Poster grids** fill the width with a minimum card width rather than a
  fixed column count.
- **Rows** scroll horizontally and show a partial next card to signal more.

## Elevation & Depth

Depth comes from **tonal layers**: background → surface → raised → overlay,
each a step lighter. Shadows are reserved for floating elements (menus,
dialogs, the player bar) and are soft and dark. Over artwork, a scrim or
gradient fade keeps text readable; text never sits directly on a busy image.

## Shapes

Soft but not bubbly.

- **Posters and thumbnails:** 10px corners.
- **Panels and dialogs:** 14px.
- **Sheets:** 20px top corners.
- **Buttons, chips, search field, play controls:** fully round (pill or
  circle).
- **Inputs:** 10px.

## Motion

Motion explains change; it never decorates.

- Enter: 200ms, ease-out. Exit: 150ms, ease-in. Hover and press: 120ms.
- Sheets and the player use spring physics; everything else uses CSS
  transitions.
- Player controls fade out after 3 seconds of inactivity and back in on any
  input.
- With `prefers-reduced-motion`, replace movement with opacity changes.

## Components

- **Primary button:** Finora blue pill, white Bold label. Hover lightens.
- **Play button:** the only element filled with the logo gradient; circular
  on cards, pill with label on detail pages.
- **Secondary button:** overlay-coloured pill.
- **Poster card:** 2:3 artwork with 10px corners on a raised surface; title
  and year below; progress bar along the bottom edge when partially watched.
- **Thumbnail card:** 16:9 for episodes and home videos, same treatment.
- **Placeholder artwork:** when Jellyfin has no image, a surface-raised tile
  with the jellyfish mark and the title — never invented imagery.
- **Input:** surface background, 10px corners, visible focus ring.

## Do's and Don'ts

- Do let artwork carry the colour; keep chrome neutral.
- Do use the logo gradient only for Play and progress.
- Do test every screen with long Bengali titles and missing artwork.
- Do keep focus rings visible on every interactive element.
- Don't put text directly on artwork without a scrim or gradient.
- Don't use glassmorphism, neon glows or decorative motion.
- Don't add new colours without adding a token here first.
- Don't use Thin weight for body text.
