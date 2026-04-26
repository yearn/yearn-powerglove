# Addendum: Harvest / Compounding / Unlocking for Powerglove

## Context

This addendum extends the harvest/compounding/unlocking research for **Powerglove**.

Powerglove is a frontend-only vault explorer:
- it already uses `ApolloProvider` in `src/main.tsx`
- `src/lib/apollo-client.ts` currently points at `import.meta.env.VITE_PUBLIC_GRAPHQL_URL`
- vault detail pages render from `src/routes/vaults/$chainId/$vaultAddress/index.tsx`
- the shared chart shell lives in `src/components/charts/charts-panel.tsx`
- the current vault page data flow is coordinated by `src/hooks/useVaultPageData.ts`

For this addendum, **Powerglove should not add its own backend**. It should retrieve the new data by calling the **yearn.fi backend** over HTTP and render the result in the existing chart and vault-page shell.

## Goal

Add the same user-facing concepts described in the research brief to Powerglove:
- harvests and compounding events
- debt reallocation / strategy movement
- current unlocking state and unlock rate

The implementation model is:
- **yearn.fi backend = source of truth and data normalization**
- **Powerglove = presentation client only**

## Non-goals

- No Envio integration in Powerglove
- No RPC reads in Powerglove
- No Redis / event matching logic in Powerglove
- No business-rule duplication in Powerglove
- No attempt to reconstruct vault state from Kong or GraphQL directly if yearn.fi already exposes the normalized answer

## Recommended architecture

### 1) yearn.fi backend owns aggregation

The backend should expose normalized JSON for Powerglove to consume, rather than making Powerglove understand the raw event/indexer schema.

The backend response should provide:
- current vault unlock state
- unlock progress over time
- harvest / compound / reallocation events
- live vault snapshot values needed to annotate the chart
- timestamps, block numbers, tx hashes, and human-readable labels

### 2) Powerglove only fetches normalized data

Powerglove should fetch from yearn.fi with a small HTTP client and treat the payload like any other remote chart source.

The UI should not know whether the source underneath is:
- Envio
- RPC
- Redis
- historical backfill

It should only know:
- what to draw
- what to label
- what to show on hover / click

### 3) Keep the current chart shell

Powerglove already has the right shell for this:
- `src/components/charts/charts-panel.tsx` can host the new tabs
- `src/routes/vaults/$chainId/$vaultAddress/index.tsx` already composes the vault page
- `src/hooks/useVaultPageData.ts` is the best place to add a new remote data hook

The feature should slot into the existing vault page instead of creating a separate screen.

## Suggested backend contract

This is the shape Powerglove should expect from yearn.fi.
The exact endpoint names can evolve, but the contract should stay stable and normalized.

### A. Vault event timeline

`GET /api/vault-events?chainId=1&vaultAddress=0x...&types=harvest,compound,debt_update,unlock_update`

Returns a chronological list of normalized event rows:

```ts
{
  eventType: 'harvest' | 'compound' | 'debt_update' | 'unlock_update'
  chainId: number
  vaultAddress: string
  strategyAddress?: string
  txHash: string
  blockNumber: number
  timestamp: number
  label: string
  description: string
  valueUsd?: number
  assetsDelta?: string
  sharesDelta?: string
  ppsBefore?: number
  ppsAfter?: number
  unlockedShares?: string
  unlockRatePerDay?: number
}
```

### B. Current vault state

`GET /api/vault-state?chainId=1&vaultAddress=0x...`

Returns the live state needed for the header cards and unlock summary:

```ts
{
  chainId: number
  vaultAddress: string
  pps: number
  totalAssetsUsd: number
  unlockedShares: string | null
  unlockPercent: number | null
  unlockRatePerDay: number | null
  estimatedDaysToUnlock: number | null
  profitMaxUnlockTime: number | null
  updatedAt: number
}
```

### C. Time series for charts

`GET /api/vault-timeseries?chainId=1&vaultAddress=0x...&series=pps,unlock_percent,unlock_rate`

Returns a compact chart series payload:

```ts
{
  pps: Array<{ date: string; value: number | null }>
  unlockPercent: Array<{ date: string; value: number | null }>
  unlockRate: Array<{ date: string; value: number | null }>
}
```

## Powerglove integration points

### 1) Add a small yearn.fi API client

Powerglove should add a fetch-based client, for example:
- `src/lib/yearnfi-client.ts`
- or `src/hooks/useYearnFiVaultActivity.ts`

This client should:
- read a base URL from env, for example `VITE_YEARNFI_API_URL`
- call yearn.fi endpoints with `fetch`
- normalize HTTP errors into a simple `Error`
- return `404` / empty data gracefully

### 2) Extend vault page data loading

`src/hooks/useVaultPageData.ts` is the best place to add a new hook result for:
- event timeline data
- unlock state data
- unlock timeseries data

This keeps the vault page route clean and makes the feature testable.

### 3) Reuse the existing chart panel

`src/components/charts/charts-panel.tsx` can be extended with a new tab set, for example:
- `Performance`
- `Harvests`
- `Unlocking`
- `Reallocation`

If the tab count feels too large, a good fallback is:
- keep the current performance tabs
- add a new adjacent “Vault State” panel beneath them

### 4) Add an explanation feed

Powerglove should show a small, readable feed under the chart.
The feed should use the same plain-English event language as the research brief:
- “Harvest realized profit”
- “Compound event moved value into the vault”
- “Debt reallocated from one strategy to another”
- “Unlock rate accelerated / slowed”

## UI guidance for Powerglove

Because Powerglove is a clean explorer, the new section should stay restrained:
- one prominent chart area
- one compact state summary strip
- one short event feed
- no heavy control chrome

Good default layout:
1. header cards
2. one chart with event markers
3. one concise timeline feed
4. optional detail drawer/modal on click

## CORS / transport expectations

Because Powerglove is not hosting the backend, yearn.fi must expose the necessary CORS headers for the Powerglove origin(s).

Powerglove should assume:
- requests may be cross-origin
- the backend may be cached
- responses are JSON-only
- endpoint failures may happen independently of the chart shell

## Suggested acceptance criteria

- Powerglove can fetch vault harvest / compounding / unlock data from yearn.fi with no local backend.
- The vault detail page shows a clear event timeline and unlocking state.
- The chart remains readable at a glance on desktop and mobile.
- Missing or empty remote data does not break the vault page.
- Existing vault performance charts continue to work unchanged.

## What should remain in yearn.fi vs Powerglove

### yearn.fi should own
- event indexing
- historical reconciliation
- vault-state derivation
- unlock-rate math
- normalized API payloads

### Powerglove should own
- display logic
- chart rendering
- tooltips / labels / callouts
- route composition
- presentation-only empty states

## Implementation note

The cleanest future path is to keep Powerglove as a thin client over a yearn.fi API surface that is already shaped for UI consumption.
That keeps the feature fast to ship, easy to test, and avoids duplicating backend logic in two places.
