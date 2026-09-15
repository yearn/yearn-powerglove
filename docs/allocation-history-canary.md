# Allocation history integration canary

This branch isolates the allocation history chart from
`codex/qtov-on-improved-fee-data` at `a73566b`, on top of `master` at
`1be0f78`. It carries the final chart, table, compact API parser, ledger,
shared allocation helpers, and their tests. The main allocation changes came
from `7fb9aae`, `c2c8efc`, and `a73566b`.

## Scope and dependencies

The chart uses master's existing vault page and strategies panel. Pagination
state and callbacks are threaded through those components; selection is keyed
by panel ID so prepending older entries preserves the selected interval.

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
`projection=chart&limit=25&direction=desc`, adding `cursor` for older pages.
The former `VITE_PUBLIC_REALLOCATION_API_URL` is no longer used.

The API must provide the compact contract: `vault`, `strategies`,
`boundaryStates`, `currentSnapshot`, visible `strategy_reallocation` entries,
interval flows and reconciliation, execution metadata, `expectedAprImpact`,
`detailsHref`, and `pagination.nextCursor`. See
`src/hooks/useReallocationData.ts` for the exact validation and
`src/hooks/useReallocationData.test.tsx` for executable examples.

## Canary checks

- Open a supported vault and select **Historical Allocations**.
- Check observed strategy balances and the current safe-head interval.
- Navigate **Older** far enough to fetch another page; selection must remain
  stable when entries are prepended.
- Follow execution and evidence links; relative `detailsHref` resolves against
  the configured API origin.
- Keep DOA proposal APR estimates separate from observed allocation balances.
- A 404 or empty history hides the tab. Malformed responses and request
  failures show an allocation-specific error notice; the vault page remains
  usable. Failed requests are retried once.
- Missing boundary states and intervals whose flows fail exact balance checks
  show an incomplete-history notice with affected entry IDs. Verified intervals
  remain available; the omitted intervals are never presented as valid flows.

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
