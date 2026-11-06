# Strategy research and live liquidity pilot

> QTOV reference imported from codex/qtov-on-improved-fee-data at f1fc4bd.
> This describes the source branch's design and pilot. The tranche branch imports
> the registry, research records and reporting readers, not the complete pilot UI.


This branch now prioritizes researched strategy context and additional live measurements. The earlier generic snapshot-export/Evidence-tab experiment has been removed. The original QTOV research toolkit remains available for evidence collection and investigation.

## First supported allocator

Ethereum yvUSDC-1 (`0xbe53a109b494e5c9f97b9cd39fe969be68bf6204`) is the pilot. Its five reviewed active strategies have individual strategy pages: the USDS depositor, sUSDS lender, direct MetaMorpho vault, Pawn Broker lending market, and Spark lender.

`src/components/strategy-details/strategyResearch.ts` stores reviewed capital paths, yield sources, exit paths, dependencies, explicit research gaps, dates, source links, and typed adapter configuration. It stores no current balances, rates, or queue membership. These records extend the existing strategy-template registry. They can later move to the proposed CMS metadata contract without changing the meaning of the data.

The starting source is [Yearn's yvUSDC curation report dated July 13, 2026](https://curation.yearn.fi/report/yearn-yvusdc/). Descriptions are sourced research, not a new assurance claim. Implementation-specific audit applicability remains unestablished. Mutable `vault()` and `LENDING_POOL()` pointers are checked against the configured destination on every collection; a mismatch suppresses values from the old destination and requests research review.

## Live data ownership

- The parent vault's Liquidity section reads its current queue, queue enforcement, withdrawal-limit module, idle assets, and owner-specific strategy withdrawal limits.
- Individual strategy pages show researched mechanics alongside current parent-position and protocol-specific observations.
- Morpho pages reuse indexed market composition, collateral, utilization, liquidity and rate data. Missing numeric data makes that response unavailable. Positive dust allocations remain included. Supply caps are denominated in the loan token, not assumed to be USD.
- Savings and nested-vault adapters query the verified destination, the strategy's share balance, converted asset value and owner-specific `maxWithdraw`. Destination amounts use the underlying token's decimals and symbol, not receipt-token decimals or a presumed 1:1 conversion.
- The Pawn Broker adapter reads token cash, outstanding loan debt and borrowing rate. It is a lender, not the separate yvUSD leveraged looper. Borrowing rate is not presented as depositor yield.
- The Spark adapter verifies the pool destination; its protocol reserve utilization and pause controls remain an explicit gap.

## Liquidity methodology

Each RPC collection pins one block and shows its time. Strategy enrichment and parent-position queries have independent observation times. Morpho API retrieval time is not represented as a matching chain block.

The V3 interface follows the [v3.0.2 vault source](https://github.com/yearn/yearn-vaults-v3/blob/v3.0.2/contracts/VaultV3.vy): `get_default_queue`, `use_default_queue`, `withdraw_limit_module`, `strategies`, and ERC-4626 owner-specific reads. This pilot does not claim support for every vault version or hook model.

Candidate strategies are the union of current metadata, the onchain withdrawal queue, and reviewed research entries. Current debt is read for each candidate at the same block. The sum is reconciled against vault `totalDebt`, so omitted funded positions or failed debt reads remain visible as a partial accounting scope. Reconciliation does not certify all strategy lifecycle events or protocol exposure coverage.

The summary deliberately distinguishes accounting from executable liquidity:

- Vault-held assets = `totalIdle`.
- Debt in the default queue = sum of that queue's `strategies(address).current_debt`.
- Debt outside the queue = `totalDebt` minus queued debt, unavailable if the queue/debt inputs are missing or inconsistent.
- Per-strategy reported withdrawal limit = `strategy.maxWithdraw(parentVault)` in verified matching asset units.
- Parent position value = `strategy.convertToAssets(strategy.balanceOf(parentVault))`.

Withdrawal limits are not summed into a claimed vault liquidity total. Shared pools, asset conversion, losses, limits, and queue rules require further modeling or simulation. Raw amounts remain bigint until presentation. Zero, missing input, and read failure remain distinct; very small positive or negative amounts are not rounded into zero.

## Verification and remaining scope

On September 16, 2026, live reads verified both researched `vault()` destinations and the Spark pool address. The five strategy debts reconciled at the sampled block; Pawn Broker was outside the forced default queue. These observations are validation evidence, not constants baked into the UI.

Tests exercise failed queue/decimal/withdrawal reads, asset mismatches, non-queued debt, incomplete inventory, block pinning, holder arguments, changed destinations, underlying decimals, and the lender/looper distinction. Browser review covers the parent and individual strategy pages.

Next work should expand protocol-specific interpretation: recursive nested-vault exits, Spark reserve conditions, collateral liquidation dependencies, conversion quotes, audit applicability, and more strategy families. Report scheduling, fleet discovery, and generic accounting snapshots are not dependencies of this pilot.
