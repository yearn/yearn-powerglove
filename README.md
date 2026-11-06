# Yearn Powerglove

Yearn vault explorer built with React, TypeScript, Vite, TanStack Router, Apollo, and Wagmi.

## Prerequisites

- Node `^22.22.2 || ^24.15.0 || >=26.0.0` (required by jsdom 30); Bun is recommended for scripts.
- `bun run test` and `bun run test:watch` check the Node version before loading jsdom.
- Bun installs disable lifecycle scripts via `ignoreScripts = true`; verify the required Node version before installing.
- Copy `.env.example` to `.env` and set values such as `VITE_PUBLIC_GRAPHQL_URL`.

## Install

```bash
bun install
```

## Run

- Dev server: `bun run dev`
- Type-check & build: `bun run build`
- Preview latest build: `bun run preview`
- Tests: `bun run test` (or `bun run test:watch`)
- E2E tests: `bun run test:e2e` (run `bunx playwright install` first)
- Lint: `bun run lint`
- Format: `bun run format`

## Editing

- App code lives in `src/`:
  - `components/` (Radix + Tailwind UI)
  - `routes/` (TanStack Router)
  - `contexts/`, `hooks/`, `utils/`
  - GraphQL queries in `src/graphql/`
- Router file `src/routeTree.gen.ts` is generated; do not edit by hand.

## Vault overrides & blacklist

Manual overrides and blacklist entries are defined in `src/constants/vaultOverrides.ts`.

- Each entry is a `VaultOverrideConfig` with:
  - `chainId`, `address`
  - Optional `overrides` (partial fields on the vault), e.g. `name`, `symbol`, `meta.description`, `tvl.close`, `apy.monthlyNet`, `forwardApyNet`.
  - Optional `overrideReason` (shown in the banner).
  - Optional `blacklist` + `blacklistReason`.
- The array `VAULT_OVERRIDE_ENTRIES` is reduced into an internal map automatically; just add a new object to the array.
- Blacklisted vaults are hidden from lists/search, but direct vault pages still render with warnings and a disabled overlay.

Example entry:

```ts
{
  chainId: 1,
  address: '0x1234...',
  overrideReason: 'Upstream metadata incorrect. TVL set manually.',
  overrides: {
    name: 'My Vault',
    tvl: { close: 0 },
    apy: { monthlyNet: 0 },
  },
  blacklist: true,
  blacklistReason: 'Disabled until investigation completes.',
}
```

## Testing notes

- Vitest runs in jsdom with Testing Library; shared mocks live in `setupTests.ts`.
- Prefer mocking Apollo/HTTP rather than hitting live services.

## Yearn Data fee and earnings pairing

Set `VITE_PUBLIC_YEARN_DATA_API_URL` to select a public Yearn Data origin,
or leave it empty to use the same-origin server proxy. The hosted proxy reads
server-only `YEARN_DATA_API_URL`; local Vite uses `VITE_YEARN_DATA_API_TARGET`
and defaults to `https://yearn-data-api-preview.vercel.app`. These settings
cover current TVL, fee summary/history/catalog, fee-stack, profitability, audit,
graph, and comparison views. Legacy TVL/fees/metrics public URL settings apply
only to supplementary endpoints outside these current routes.

The core summary selects an opaque dataset ID, which pins history and vault
requests to the same completed publication. The Fees tab displays the published
amounts without coverage counters or source-quality reasons. Developers retain
those diagnostics in yearn-data's selected publication and native exports.

Use the yearn-data repository's `docs/powerglove-pairing.md` for source selection,
cutoff/pricing requirements and manual refresh. Rebuild after changing public
Vite configuration; review Stats at `/` and additional analysis at `/stats/analysis`.
