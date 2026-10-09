# Allocation history integration canary

This branch isolates the allocation history chart from
`codex/qtov-on-improved-fee-data` at `a73566b`, on top of `master` at
`1be0f78`. It carries the final chart, table, compact API parser, ledger,
shared allocation helpers, and their tests. The main allocation changes came
from `7fb9aae`, `c2c8efc`, and `a73566b`.

## Scope and dependencies

The chart uses the existing vault page and strategies panel. Each request loads the full vault history.
Selection is keyed by panel ID so a refresh preserves the selected checkpoint when it remains available.
Executed history shows a Sankey derived from checkpoint balances, with net asset increase/decrease nodes for unmatched totals. Ribbons are illustrative net changes, not verified transfer paths. The single net-change source or sink sits in the center, outside the strategy stacks. Strategy columns show each checkpoint’s own allocation percentages; links and the net-change percentage use the larger total as a common asset scale. Optimizer recommendations retain their existing visualization.

No QTOV reporting, fee/TVL dashboards, strategy detail templates, RPC client,
new routes, dependency changes, or lazy-asset recovery are required. Earlier
allocation-specific optimizer labels and helper behavior travel with the shared
chart files to preserve their tested behavior.

## Pointing the canary at a backend

Set this in an ignored `.env.local` and rebuild (or restart Vite):

```dotenv
VITE_PUBLIC_ALLOCATION_HISTORY_API_URL=http://localhost:5456/api/rest/views/allocation-history
```

For a remote browser, use a browser-reachable API origin with appropriate CORS.
To test Kong, replace the value with Kong's allocation-history base URL. The
consumer appends `/{chainId}/{lowercaseVaultAddress}` and requests
`direction=desc`. There is no projection selector, limit, cursor, or load-more request.
The former `VITE_PUBLIC_REALLOCATION_API_URL` is no longer used.

The API must provide schema version 3 and `runId`, plus `vault` (including asset decimals and symbol), `strategies`,
`boundaryStates`, `currentSnapshot`, visible `strategy_reallocation` entries,
checkpoint intervals with `startState`, `endState`, and signed `changes`, execution metadata, `expectedAprImpact`,
and `detailsHref`. Older schema versions are rejected. See
`src/hooks/useReallocationData.ts` for the exact validation and
`src/hooks/useReallocationData.test.tsx` for executable examples.

## Canary checks

- Open a supported vault and select **Historical Allocations**.
- Check observed strategy balances and the current safe-head interval.
- Navigate **Older** and **Newer** through the already-loaded history; no extra history requests should occur.
- Follow execution and evidence links; relative `detailsHref` resolves against
  the configured API origin.
- Keep DOA proposal APR estimates separate from observed allocation balances.
- A 404 or empty history hides the tab. Malformed responses and request
  failures show an allocation-specific error notice; the vault page remains
  usable. Failed requests are retried once.
- Missing boundary states, mismatched endpoints, or incorrect signed changes show an incomplete-history notice
  with affected entry IDs. Valid comparisons remain available. Net balance changes do not imply gross external flows
  or movement paths between strategies.

Run `bun run test` and `bun run build` when switching the backend contract.

## Migration validation (2026-09-15)

- Production build and TypeScript checks passed.
- Existing migrated suite: 34 files, 157 tests passed. Added parent-component
  pagination/selection regression: 1 test passed.
- Biome checks on the changed TypeScript files and `git diff --check` passed.
- Live yvUSDC-1 browser check rendered current and historical allocations,
  navigated through a cursor boundary, and opened interval evidence (HTTP 200).
  No allocation-query or JavaScript errors were observed. The 390px viewport
  had no horizontal overflow.
- All ten transplanted allocation implementation/test files match source
  `a73566b` exactly; only master page wiring, configuration example, the new
  parent-component test, and this guide were adapted or added.

The local API snapshot observed during this check ended on September 10, 2026;
this validates consumer integration, not live indexing freshness or Kong's
future implementation.

## Review fixes

Runtime validation now rejects malformed APR and execution metadata before
normalization. Query failures appear in an allocation-specific notice without
replacing the vault page. Interval reconstruction returns diagnostic entry IDs
for missing boundary states, invalid references, and failed balance checks;
verified intervals remain visible beside an incomplete-history notice.

## Checkpoint fixture

`src/hooks/allocation-checkpoints.fixture.json` is a test fixture derived from the
provisional yvUSDC-1 schema-3 preview response (run 7). It retains two recent
entries and the current snapshot; the oldest retained entry's interval is set to
null to provide a starting checkpoint. It is not a complete history capture or
independent validation of the source data.
