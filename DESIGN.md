---
name: Yearn Powerglove
description: A calm, sharp, editorial vault explorer for power DeFi analysis.
colors:
  yearn-blue: "#0657f9"
  ink: "#0a0a0a"
  body: "#4f4f4f"
  muted: "#808080"
  canvas: "#f5f5f5"
  surface: "#ffffff"
  line: "#e5e5e5"
  soft-line: "#f5f5f5"
  success: "#16a34a"
  danger: "#7f1d1d"
  chart-blue: "#46a2ff"
  chart-lavender: "#94adf2"
typography:
  display:
    fontFamily: "Aeonik, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  headline:
    fontFamily: "Aeonik, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  title:
    fontFamily: "Aeonik, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "Aeonik, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Aeonik, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.08em"
  mono:
    fontFamily: "Aeonik Mono, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
rounded:
  none: "0px"
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.yearn-blue}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
    height: "40px"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.yearn-blue}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "8px 12px"
    height: "36px"
  input-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
    height: "40px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "24px"
---

# Design System: Yearn Powerglove

## 1. Overview

**Creative North Star: "The Analyst's Ledger"**

Yearn Powerglove should feel like a precise ledger for people who already know what they are looking at: calm enough for repeated analysis, sharp enough to reward scrutiny, and editorial enough that hierarchy feels intentionally composed. The system is dense, but density is edited through spacing, rules, restrained color, and compact typographic contrast.

The visual language rejects boring SaaS dashboard tropes, generic overstuffed AI dashboard patterns, and gamified slop. It should never look like an interchangeable card grid, a neon crypto toy, or a pile of AI-generated panels. The interface earns trust by making numbers, filters, tables, chart states, and vault events feel legible and sober.

**Key Characteristics:**
- Flat white analytical surfaces on a pale gray canvas.
- Yearn blue used sparingly for action, selection, sorting, loading, and active state.
- Dense tables, compact labels, and tabular numbers with clear row rhythm.
- Borders and rules create structure; shadows are reserved for overlays.
- Motion is quiet, limited to state feedback and loading progress.

## 2. Colors

The palette is restrained: white and gray carry almost all surface area, while Yearn blue marks meaningful action and selection.

### Primary
- **Ledger Blue**: Primary action, active tab underline, selected filter state, sort indicator, loading progress, and high-confidence links. Its rarity is part of its authority.

### Secondary
- **Chart Blue**: Chart line work and analytical graph accents. Use it for data series, not for decorative page color.
- **Analyst Lavender**: Secondary chart line and ghosted overlay color. Use at low opacity when layering context behind the active series.

### Neutral
- **Ink**: Primary text and high-emphasis data.
- **Body Gray**: Secondary text, event descriptions, icon color, and supporting values.
- **Muted Gray**: Labels, timestamps, filter captions, empty-state support text, and low-emphasis metadata.
- **Canvas Gray**: App background and subtle hover fill.
- **Surface White**: Panels, rows, controls, popovers, and table bodies.
- **Line Gray**: Borders, input strokes, table dividers, and panel separation.
- **Soft Line**: Internal strategy/event separators and low-contrast structural rules.

### Named Rules

**The Blue Earns Its Place Rule.** Use Ledger Blue only for interaction, selection, sorting, loading, and navigational affordance. Do not use it as generic decoration.

**The White Surface Rule.** Analytical content lives on white. The surrounding canvas may be pale gray, but panels and rows should stay quiet and readable.

## 3. Typography

**Display Font:** Aeonik with sans-serif fallback
**Body Font:** Aeonik with sans-serif fallback
**Label/Mono Font:** Aeonik Mono with monospace fallback

**Character:** Aeonik gives the product a clean editorial voice without making labels feel precious. Aeonik Mono is reserved for addresses, technical values, and places where numerical precision benefits from mechanical texture.

### Hierarchy
- **Display** (700, 1.875rem, 1.2): Vault names and the largest page-level identity moments.
- **Headline** (600, 1.5rem, 1.25): Major panel titles and section-level analysis headings.
- **Title** (600, 1rem, 1.4): Row names, table emphasis, mobile vault names, and compact panel headings.
- **Body** (400, 0.875rem, 1.5): Default UI text, descriptions, row values, and control labels. Keep prose to roughly 65-75ch.
- **Label** (500, 0.6875rem, 0.08em tracking): Uppercase metadata labels, table micro-headings, and compact sort/filter captions.
- **Mono** (400, 0.875rem, 1.45): Addresses, hash-like values, and tabular technical readouts when a mechanical voice improves scan accuracy.

### Named Rules

**The Expert Reader Rule.** Do not inflate type to explain importance. Use compact scale, weight, alignment, and position so expert users can scan without being shouted at.

## 4. Elevation

The system is flat and bordered by default. Depth is conveyed through surface changes, thin rules, active underlines, and row hover fills. Shadows are acceptable for popovers, dropdowns, dialogs, and other temporary overlays where the user needs spatial separation from the data plane.

### Shadow Vocabulary
- **Overlay Shadow** (`0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`): Dropdowns, popovers, search results, and temporary floating UI only.
- **Low Shadow** (`0 1px 2px 0 rgb(0 0 0 / 0.05)`): Legacy card primitive support. Avoid adding it to new analytical panels unless an existing component requires it.

### Named Rules

**The Flat Ledger Rule.** Surfaces are flat at rest. If a shadow appears on a persistent panel, the panel is probably trying too hard.

## 5. Components

### Buttons

Buttons are precise and restrained: rectangular, compact, and action-oriented.

- **Shape:** Square by default for product actions (0px), with small-radius primitives available only where inherited Radix/shadcn components require them.
- **Primary:** Ledger Blue fill, white text, 40px height, 16px horizontal padding.
- **Hover / Focus:** Hover darkens through opacity. Focus must be visible with a 2px ring or outline, not color alone.
- **Outline:** White surface, Ledger Blue border/text for external or secondary calls to action.
- **Ghost / Link:** No fill at rest. Hover may use Canvas Gray or underline, but never a decorative color wash.

### Chips

Chips and filter pills are small analytical switches, not badges for decoration.

- **Style:** Thin border, compact padding, body or label text.
- **Selected:** Ledger Blue border with a very pale blue tint and Ledger Blue text.
- **Unselected:** White or Canvas Gray background, Line Gray border, Body Gray text.

### Cards / Containers

Containers should read as ledger sections rather than cards.

- **Corner Style:** Square to gently curved, never pillowy (0-8px).
- **Background:** Surface White on Canvas Gray.
- **Shadow Strategy:** Flat by default; use borders and internal rules.
- **Border:** 1px Line Gray or Soft Line.
- **Internal Padding:** 16-24px for panels, 8-12px for dense row content.

### Inputs / Fields

Inputs are utilitarian and searchable.

- **Style:** White background, 1px Line Gray stroke, compact 40px height, 12px horizontal padding.
- **Focus:** Visible ring or Ledger Blue outline; the field should become unmistakably active.
- **Error / Disabled:** Error uses destructive red with text support. Disabled lowers opacity and blocks interaction.

### Navigation

Navigation is sticky, compact, and brand-light. The logo and product name identify the surface, while search and partner action stay in the task lane. Active navigation and tabs use Ledger Blue underlines or text, not large filled blocks.

### Tables and Lists

Rows are the core product texture. Desktop vault rows use 50px height, white background, bottom borders, and Canvas Gray hover. Mobile rows use a 72px height with token and chain icons stacked into compact metadata. Empty states should explain the filter mismatch plainly without marketing copy.

### Charts

Charts use restrained blue series, muted axis labels, and optional ghosted context overlays at low opacity. Controls sit close to the chart and should not compete with the data. If multiple series are shown, every important state needs a label or control, not color alone.

## 6. Do's and Don'ts

### Do:

- **Do** keep Yearn Blue rare and functional: active tab, selected filter, primary action, sort state, loading progress, or link.
- **Do** use borders, rules, row height, and alignment to create hierarchy before adding containers.
- **Do** keep tables and event streams dense, but edited through predictable rhythm and compact labels.
- **Do** make focus states visible for keyboard users and avoid chart encodings that rely on color alone.
- **Do** use short, exact copy for errors, empty states, filters, and labels.

### Don't:

- **Don't** create boring SaaS dashboard tropes: interchangeable metric cards, decorative gradients, soft corporate sameness, or visual hierarchy assembled from defaults.
- **Don't** create generic overstuffed AI dashboard patterns: crowded assistant panels, vague summary widgets, excessive badges, or impressive-looking blocks that do not help analysis.
- **Don't** create gamified slop: reward language, casino energy, toy-like visuals, neon crypto terminal clichés, or playful interactions that trivialize serious analysis.
- **Don't** use side-stripe borders, gradient text, glassmorphism, hero-metric templates, or identical card grids.
- **Don't** use modals as the first solution for ordinary filtering, sorting, or drill-down. Prefer inline controls and progressive disclosure.
