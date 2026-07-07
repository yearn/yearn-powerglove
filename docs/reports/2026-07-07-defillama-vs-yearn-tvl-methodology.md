# DefiLlama vs Yearn TVL Methodology

Date: 2026-07-07

## Summary

DefiLlama's current `yearn-finance` adapter undercounts Yearn TVL because it drops entire vaults when those vaults also appear as strategies inside another vault. That avoids some double-counting, but it is too blunt: a vault can be mostly externally funded while also receiving a small allocation from an upstream Yearn vault.

Yearn's local methodology keeps those vaults in the TVL graph and deducts only the nested allocation that would otherwise be double-counted.

## DefiLlama Methodology

The current DefiLlama adapter:

1. Fetches Yearn vaults from yDaemon.
2. Builds a set of every strategy address used by those vaults.
3. Keeps positive-TVL V2/V3 vaults only if the vault address is not blacklisted and does not appear in that strategy-address set.
4. Reads each remaining vault's `totalAssets()`.
5. Reads the underlying token via `token()` or `asset()`.
6. Adds the full underlying balance to DefiLlama's token-balance accounting.
7. Adds Ethereum V1 vaults separately from a hardcoded static V1 list.

The important rule is:

```text
exclude vault if vault.address appears in any other vault's strategies
```

This treats every nested vault as fully internal Yearn capital, even when only part of that vault's TVL comes from another Yearn vault.

Source: https://raw.githubusercontent.com/DefiLlama/DefiLlama-Adapters/main/projects/yearn/index.js

## Yearn Local Methodology

Yearn's local methodology treats vaults and strategies as a graph:

- Vaults are nodes.
- Parent-vault allocations into child vaults are edges.
- Raw TVL is the vault's total assets.
- Counted TVL is raw TVL minus deductible incoming or outgoing overlap, depending on the accounting view.

This means a child vault is not discarded just because it is used by another vault. Instead, only the upstream allocation that would be double-counted is deducted.

Example:

```text
Child vault raw TVL:          $27.57M
Parent allocation to child:   $0.11M
Correct counted child TVL:    about $27.46M
DefiLlama counted child TVL:  $0
```

## Why DefiLlama Is Flawed Here

The DefiLlama method conflates two different facts:

1. A vault is used as a strategy by another vault.
2. All of that vault's TVL is already counted somewhere else.

The second does not follow from the first.

When DefiLlama removes the whole child vault, it removes external depositor capital that is not double-counted. The correct fix is to keep the child vault and subtract only the actual parent allocation into it.

## Practical Consequence

Many V3 allocator vaults are excluded from DefiLlama even though they hold real externally sourced TVL. This causes DefiLlama's `yearn-finance` number to be materially lower than a vault-graph calculation that accounts for overlap precisely.

For comparison tooling, the useful distinction is:

- `DL`: vault is counted by the DefiLlama-compatible methodology.
- `local only`: vault is counted by Yearn's local graph methodology but missing from DefiLlama's comparable calculation.

`local only` does not mean the vault is invalid. It usually means the current DefiLlama adapter dropped the whole vault because it appears as a nested strategy somewhere else.

## Correct Direction

A better DefiLlama adapter should:

1. Discover Yearn vaults from Kong or another complete Yearn source.
2. Keep positive-TVL Yearn vaults even if they appear as strategies.
3. Build vault-to-vault edges from strategy debt.
4. Deduct only the actual nested allocation.
5. Keep hardcoded blacklist and V1 handling separate.
6. Avoid raw-unit subtraction unless parent and child share the same underlying asset.

This preserves DefiLlama's goal of avoiding double-counting without throwing away real downstream TVL.
