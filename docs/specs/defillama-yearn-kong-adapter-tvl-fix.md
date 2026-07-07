# DefiLlama Yearn Adapter: Kong Migration and Vault Graph TVL Fix

Date: 2026-05-29

## Goal

Update the DefiLlama `yearn-finance` adapter so it:

1. Uses Kong as the Yearn vault discovery and metadata API.
2. Counts nested Yearn vault TVL without dropping real downstream capital.

This spec targets the `projects/yearn/index.js` adapter in `DefiLlama/DefiLlama-Adapters`.

## Current Problem

The current adapter fetches yDaemon:

```text
https://ydaemon.yearn.fi/vaults?highlight_multi_single&hideAlways=false&orderBy=featuringScore&orderDirection=desc&strategiesDetails=withDetails&strategiesCondition=inQueue&chainIDs=${api.chainId}&limit=2500
```

It then builds a global strategy-address set:

```js
let strategies = data.map(v => v.strategies ?? []).flat().map(v => v.address.toLowerCase())
let vaults = data
  .filter(i => +i.tvl.tvl > 0)
  .map(v => v.address.toLowerCase())
  .filter(i => !blacklist.includes(i) && !strategies.includes(i))
```

That rule avoids some double counting, but it is too broad. If a vault appears as a strategy in any other vault, DefiLlama excludes the entire child vault, even when only a small amount of upstream capital is allocated to it.

## Concrete Failure: USDC-1 yVault

Vault:

```text
USDC-1 yVault
0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204
```

Live yDaemon and Kong both report about `$27.57M` TVL for USDC-1. Kong reports its main current strategy debt as:

```text
USDC-1 -> USDC to sUSDS Lender
0x7130570BCEfCedBe9d15B5b11A33006156460f8f
currentDebtUsd ~= $27.55M
```

But USDC-1 also appears as a strategy in USDC-2:

```text
USDC-2 -> USDC-1
0xAe7d8Db82480E6d8e3873ecbF22cf17b3D8A7308 -> 0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204
currentDebtUsd ~= $107K
```

The current DefiLlama rule excludes the whole USDC-1 vault because `0xBe53...6204` appears anywhere in `strategies[]`. That drops roughly `$27.46M` of real external exposure instead of deducting only the `$107K` nested allocation.

The `endorsed` field is not the cause. The current DefiLlama adapter does not inspect `endorsed`, `status`, `isHidden`, or strategy debt while building the exclusion set.

## Kong API Layer

Replace yDaemon vault discovery with Kong GraphQL:

```http
POST https://kong.yearn.fi/api/gql
content-type: application/json
```

Suggested query:

```graphql
query YearnVaults {
  vaults(yearn: true) {
    address
    name
    chainId
    apiVersion
    v3
    yearn
    vaultType
    tvl { close blockTime }
    totalAssets
    totalIdle
    asset { address symbol decimals }
    debts {
      strategy
      currentDebt
      currentDebtUsd
      maxDebt
    }
    meta { isRetired isHidden }
    strategies
  }
}
```

Use Kong for:

- Vault list by chain.
- Asset address and decimals.
- Current strategy debts.
- Retired status and vault type.
- Hidden status, so bridge/migration/pre-deposit vaults can be reviewed or excluded deliberately.
- Current TVL sanity checks.

The adapter should still prefer on-chain reads for final DefiLlama balances where practical, using `totalAssets()` and `token()` / `asset()`. Kong provides discovery and graph structure; DefiLlama balances should remain token-balance based.

Kong GraphQL `debts.currentDebt` should be treated as the primary edge amount for same-asset vault-to-vault deductions. The REST `/snapshot/:chainId/:address` composition endpoint is composed from Kong data and should not be required as an independent debt fallback unless a live GraphQL gap is found.

## Correct TVL Model

Treat Yearn as a vault graph:

- Node: a Yearn vault.
- Edge: parent vault strategy allocation into a child Yearn vault.
- Edge amount: parent strategy debt to the child vault.
- External TVL: vault `totalAssets` minus incoming allocations from other counted Yearn vaults, floored at zero.

Do not exclude a whole child vault just because it appears as a strategy. Deduct only the amount of parent capital that is already counted upstream.

For each chain:

1. Load Kong vaults for that chain.
2. Exclude hardcoded blacklist and V1 from the V2/V3 path.
3. Decide how to handle hidden vaults explicitly. Do not accidentally count hidden bridge, migration, or pre-deposit vaults just because Kong exposes them.
4. Keep all positive-TVL V2/V3 vaults, including vaults whose address appears in another vault's `debts[].strategy`.
5. Build `vaultByAddress`.
6. Build incoming edges:
   - For every vault `parent`, for every `debt` in `parent.debts`.
   - If `debt.strategy` matches another counted vault on the same chain, add edge `parent -> child`.
   - Use `debt.currentDebt` as the raw edge amount.
7. Count every vault's on-chain `totalAssets`.
8. Subtract incoming edge amounts from the child vault, not the entire child vault.
9. Add the adjusted child balance to DefiLlama balances.

Pseudo-code:

```js
const countedVaults = kongVaults
  .filter(v => v.chainId === api.chainId)
  .filter(v => Number(v.tvl?.close ?? 0) > 0)
  .filter(v => !blacklist.includes(v.address.toLowerCase()))
  .filter(v => !v1VaultsLower.includes(v.address.toLowerCase()))
  .filter(v => !shouldExcludeHiddenVault(v))

const vaultByAddress = new Map(countedVaults.map(v => [v.address.toLowerCase(), v]))

const incomingDebtByVault = new Map()
for (const parent of countedVaults) {
  for (const debt of parent.debts ?? []) {
    const child = vaultByAddress.get(debt.strategy.toLowerCase())
    if (!child) continue
    if (child.chainId !== parent.chainId) continue
    incomingDebtByVault.set(
      child.address.toLowerCase(),
      (incomingDebtByVault.get(child.address.toLowerCase()) ?? 0n) + BigInt(debt.currentDebt ?? '0')
    )
  }
}

const totalAssets = await api.multiCall({ abi: 'uint256:totalAssets', calls: countedVaults.map(v => v.address) })
const tokens = await api.multiCall({ abi: 'address:token', calls: countedVaults.map(v => v.address), permitFailure: true })
const assets = await api.multiCall({ abi: 'address:asset', calls: countedVaults.map(v => v.address), permitFailure: true })

for (const [i, vault] of countedVaults.entries()) {
  const token = tokens[i] || assets[i] || vault.asset?.address
  if (!token) continue

  const incoming = incomingDebtByVault.get(vault.address.toLowerCase()) ?? 0n
  const adjustedAssets = totalAssets[i] > incoming ? totalAssets[i] - incoming : 0n
  if (adjustedAssets > 0n) api.add(token, adjustedAssets)
}
```

Important constraint: this direct raw subtraction is valid when the parent debt and child `totalAssets` use the same underlying asset units. For safety, only apply automatic edge subtraction when `parent.asset.address.toLowerCase() === child.asset.address.toLowerCase()`. If assets differ, do not use a raw-unit subtraction; either skip the edge and flag it, or handle it with explicit registry logic.

If a same-asset edge has missing or zero `debt.currentDebt`, skip the edge and flag it in adapter tests or debug output rather than falling back to USD values for raw-token subtraction. USD debt can be useful for review, but the DefiLlama balance object needs token amounts.

## V1 Handling

Keep the V1 path separate unless Kong adds an equivalent V1 discovery model. The current adapter already hardcodes V1 vaults and reads:

- `token()`
- `totalSupply()`
- `getPricePerFullShare()`

However, the current Ethereum path does not unwrap LP assets consistently. If this PR scope allows, set `resolveLP: true` for Ethereum too, or add targeted pricing for V1 Curve LP tokens so legacy V1 TVL is not undercounted.

## Tests

Add adapter tests or a local fixture that covers:

1. `USDC-1` counted with partial upstream allocation:
   - `USDC-1.totalAssets ~= 27.578M USDC`
   - `USDC-2 -> USDC-1 debt ~= 107K USDC`
   - Expected counted USDC-1 contribution: about `27.471M USDC`, not zero.
2. Strategy-only addresses are not counted as vaults:
   - `0x7130570BCEfCedBe9d15B5b11A33006156460f8f`
   - `0x25f893276544d86a82b1ce407182836F45cb6673`
   - They appear in Kong/yDaemon strategies but are not standalone vault rows.
3. Zero-debt strategy edges do not affect TVL.
4. Multiple parent vaults allocating to the same child sum incoming debt before deduction.
5. Deduction is floored at zero.
6. Different-asset parent/child edges are not subtracted by raw units.
7. Hidden bridge/migration/pre-deposit vaults are excluded or explicitly reviewed, not counted accidentally.

## Expected Result

For USDC-1 specifically:

- Current DefiLlama behavior: count `$0`.
- Correct graph behavior: count USDC-1 TVL net of only the USDC-2 allocation into it.
- Approximate improvement: add back roughly `$27.46M` for this vault, subject to live prices and exact on-chain balances.

For the full Yearn adapter:

- Avoid broad undercounting of vaults that are also used as strategies.
- Keep protection against double counting by deducting actual nested allocations.
- Move source-of-truth discovery to Kong, which already exposes vaults, assets, current debts, and retirement state in one query.

## Rollout Checks

Before merging:

- Compare old vs new adapter output by chain.
- Inspect every excluded/deducted edge over `$100K`.
- Confirm USDC-1 is included net of USDC-2's allocation.
- Confirm strategy-only addresses such as `0x713...` and `0x25f...` are not independently counted.
- Confirm no cross-chain raw-unit subtraction occurs.
- Confirm hidden vault handling does not count bridge, migration, or pre-deposit vaults unintentionally.
- Confirm Ethereum V1 behavior is unchanged unless LP unwrapping is intentionally included.

## Source Links

- DefiLlama Yearn adapter: https://raw.githubusercontent.com/DefiLlama/DefiLlama-Adapters/main/projects/yearn/index.js
- yDaemon endpoint currently used by DefiLlama: https://ydaemon.yearn.fi/vaults?highlight_multi_single&hideAlways=false&orderBy=featuringScore&orderDirection=desc&strategiesDetails=withDetails&strategiesCondition=inQueue&chainIDs=1&limit=2500
- Kong GraphQL endpoint: https://kong.yearn.fi/api/gql
- USDC-1 vault: https://etherscan.io/address/0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204
- USDC-2 vault: https://etherscan.io/address/0xAe7d8Db82480E6d8e3873ecbF22cf17b3D8A7308
