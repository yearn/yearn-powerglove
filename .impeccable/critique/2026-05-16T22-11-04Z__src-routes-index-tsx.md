---
target: main vaults page
total_score: 25
p0_count: 0
p1_count: 2
timestamp: 2026-05-16T22-11-04Z
slug: src-routes-index-tsx
---
# Critique: Main Vaults Page

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Loading state exists; active sort is visible, but filter state/counts are under-communicated. |
| 2 | Match System / Real World | 3 | Domain terms fit power users; the overview gives no analytical framing. |
| 3 | User Control and Freedom | 3 | Search/filter/sort are reversible; desktop lacks obvious clear-all state affordances. |
| 4 | Consistency and Standards | 3 | Mostly consistent table/filter vocabulary; duplicate header search and mixed radius/shadow choices create drift. |
| 5 | Error Prevention | 2 | Low-risk browsing surface; filter interactions can create empty results without showing what combination caused it. |
| 6 | Recognition Rather Than Recall | 3 | Columns and controls are visible; chain/type filter contents are hidden behind buttons. |
| 7 | Flexibility and Efficiency of Use | 3 | Sorting/search/virtual rows work for power use; no visible keyboard/search accelerators or saved views. |
| 8 | Aesthetic and Minimalist Design | 2 | The page is clean but under-designed: a blank-feeling overview, redundant top search, and weak editorial hierarchy. |
| 9 | Error Recovery | 2 | Error state prints raw message; empty state is plain and not filter-aware. |
| 10 | Help and Documentation | 1 | No contextual hints for data meaning, APY timeframe, vault type, or result source. |
| **Total** | | **25/40** | **Acceptable, with a strong functional base but significant hierarchy and guidance gaps.** |

## Anti-Patterns Verdict

This does not read as generic AI slop. It avoids gradient text, glass cards, neon crypto styling, hero metrics, and decorative dashboards. The main risk is the opposite: it is so plain that it undershoots the “calm, sharp, editorial” target and lands closer to an unfinished admin table.

The deterministic scan found 1 issue: `pure-black-white` in `src/components/vaults-list/VaultsFilterBar.tsx:76`, where `bg-black` is used for the mobile Yearn avatar. This is minor but real, because `DESIGN.md` explicitly asks for tinted neutrals rather than pure black/white.

Visual overlay could not be run because `npx impeccable live --port=4877` returned `Warning: cannot access live`. I continued with CLI detection plus Playwright inspection.

## Overall Impression

The page is efficient and trustworthy enough to use, but not yet distinctive enough for aesthetically sensitive power DeFi analysts. The table has good bones: dense rows, clear columns, sortable headers, and fast scan value. The biggest opportunity is turning the top third of the page from a placeholder into a real analytical command surface.

## What's Working

The table row rhythm is strong. 50px rows, right-aligned numeric columns, visible headers, and virtual scrolling give the main task a serious, usable base.

The restraint is directionally right. Color is mostly functional, and the page avoids the crypto-dashboard clichés called out in `PRODUCT.md`.

Mobile list structure is more thoughtfully composed than desktop in some ways: token/chain/type metadata is compact, APY and TVL are prioritized, and the row height is stable.

## Priority Issues

**[P1] The overview block is a title, not an overview**

Why it matters: `YearnVaultsSummary` renders only “Yearn Vaults Overview” inside a large bordered block. For power analysts, the first screen should establish what universe is being scanned: result count, total TVL, top APY range, chains represented, freshness, or active data source. Right now it spends prime space on a label.

Fix: Replace the empty summary with a compact command header: title, one sentence of domain framing, result count, aggregate TVL if available, active sort, and data freshness. Keep it flat and editorial, not metric-card-heavy.

Suggested command: `impeccable layout main vaults page`

**[P1] Desktop filter controls hide too much state**

Why it matters: “Filter Chains” and “Filter Types” are visible, but the selected state is not visible in the screenshot unless the dropdown is opened. Analysts need to know what universe they are looking at before trusting the table.

Fix: Surface selected chain/type summaries inline, add clear-all when filters are active, and show the filtered result count near search. Avoid adding badges everywhere; a single compact state line is enough.

Suggested command: `impeccable clarify main vault filters`

**[P2] The page has two competing search fields**

Why it matters: The sticky header search and the table search both appear on desktop. They have different placeholder copy and likely different scope: global vault navigation vs current-table filtering. The distinction is not visually or verbally clear.

Fix: Make scopes explicit. Header search should read like global jump/search, or be suppressed on the home vaults page. Table search should be clearly tied to the current result set.

Suggested command: `impeccable clarify main vault search`

**[P2] Sort affordance implies every column is actively descending**

Why it matters: Inactive headers show a downward chevron, while the active `TVL` sort also shows a downward chevron in blue. Color alone carries the active distinction, and the inactive arrows add visual noise.

Fix: Use a neutral sortable icon for inactive columns, hide inactive icons until hover/focus, or use a compact up/down glyph only on the active sort. Preserve the ARIA labels, which are good.

Suggested command: `impeccable polish main vault table`

**[P2] Empty and error states are too generic**

Why it matters: “No vaults found with those filters. Please adjust your filters.” does not tell users which filters are active or offer a direct recovery action. The error state exposes raw error text without a calm recovery path.

Fix: Empty state should show the active filter/search combination and a “Clear filters” action. Error state should distinguish vault data vs token asset failure and offer retry/reload.

Suggested command: `impeccable harden main vaults page`

## Persona Red Flags

**Alex, Power User:** The table is fast, but the top command surface does not expose result count, active filter summary, saved views, or keyboard accelerators. Alex can work, but they will feel the app is a list rather than an analyst tool.

**Sam, Accessibility-Dependent User:** Header and table search inputs do not have explicit labels. Active sort is communicated via ARIA, which is good, but inactive arrows plus blue-only active visual state are not ideal. Icon-only footer links render as empty text links in Playwright output and need accessible names if they do not already have them through hidden labels.

**Power DeFi Analyst, Mara:** Mara wants confidence in the universe and freshness of data. The page shows vaults, APY, and TVL, but does not say how many vaults are in view, what chains/types are included, or when data was last updated. She can scan rows but must infer too much about context.

## Minor Observations

- `src/components/YearnVaultsSummary.tsx:3` uses the right flat bordered shell, but the content is not earning the space.
- `src/components/vaults-list/VaultsFilterBar.tsx:76` uses pure black for the Yearn avatar.
- `src/components/vaults-list/VaultsFilterBar.tsx:242` adds `shadow-sm` on the mobile filter block, which conflicts slightly with the flat-ledger rule.
- `src/components/vaults-list/VaultRow.tsx:121` uses an emoji fallback, which feels off-register for a serious analytical surface.
- The page background renders white in Playwright, while the design guide specifies a pale gray canvas around white analytical surfaces.

## Questions to Consider

- What should the first screen prove before a user trusts the table: breadth, freshness, yield opportunity, or chain coverage?
- Should global search exist on the vault list page, or should the page own a single current-table search?
- What is the most editorial version of the overview that avoids turning into a hero-metric template?
- Which filter state must always be visible for an analyst to avoid misreading the data?
