# yvUSD locker bonus classified as allocator fees

## Verification update: corrected publication active in this preview

On October 9, 2026 UTC, the backend correction and its new publication were
verified read-only using the updated source in the Yearn Data main checkout.
The corrected fee run is **18**, dataset
`7ac5e43aa6ee095e6fea8991cf1ebb1c6c57a2feffa074da75b0aa776bef83f2`.

| Published metric | Corrected USD amount |
| --- | ---: |
| Actual fees | 1.5020913785179192510715 |
| Management fees | 0.533052320825365730302 |
| Performance fees | 0.9690390576925535207695 |
| Locker distributions | 30208.3417791514335400091614 |
| Original reported deduction | 30209.8438705299514592602329 |

Summary and vault totals agree, and both monthly and weekly histories sum to
these amounts under the same dataset ID. Only January 2026 has nonzero actual
fees; subsequent published months have zero actual fees.

Before retargeting, the consumer proxy and the older API on port 3491 both
served the original `6ac3d...` dataset and classified $30,209.84 as fees,
without the new `lockerBonusUsd` field. That service used the older
`yearn-data-neon` worktree and fee run 16. The corrected publication was
verified separately in the main checkout's `artifacts/yvusd-fees/publication`.

The authoritative API on port **3493** now serves the corrected dataset and
prepared analytics. This Powerglove instance's ignored local configuration
and preview service were updated to target that API, then rebuilt and
restarted. Its proxy now returns the corrected fees and separate locker
distributions. The analytics publication references the same corrected fee
dataset. Core fees, fee-stack, profitability, and analytics publication
requests returned successfully through the preview.

A browser check with USD yVault selected found only January 2026 has a
positive fee bar. The existing chart tooltip rounds $1.502091... to `$2`;
the API retains the exact amount. The check found no page errors or failed
API responses. The build and 11 focused routing/dashboard tests passed.
The chart consumes the corrected metric without an address exclusion.

## Initial finding

The allocator comparison charts plot the API's `totalFeesPaidUsd` directly.
The Yearn Data V3 normalizer takes the vault's `StrategyReported.total_fees`
as total fees and classifies `total_fees - protocol_fees` as manager fees.
For yvUSD, that event field also includes yield redistributed to locked
depositors. The normalizer does not split that redistribution from actual
management and performance fees.

This affects the published fee amounts, not just the allocator chart or its
four-week moving average. A frontend exclusion would leave summaries, fee
yield, and chain/type breakdowns inconsistent.

## Selected publication checked

Read-only verification on October 9, 2026 UTC:

- Database: Neon; fee analysis run 16.
- Dataset: `6ac3d979d9c9ad7d5f1260fa63e6da23f6d0fb36caea492a0760af3adedd40db`.
- Vault: Ethereum `0x696d02Db93291651ED510704c9b286841d506987` (USD yVault).
- 438 selected report rows; 395 have positive reported total fees.
- Published `totalFeesPaidUsd` and `managerFeesUsd`: **30,209.8438705299514592602329** each.
- Published protocol fees: **0**. No selected row has nonzero protocol fees.
- Published management and performance fee components are unavailable (`null`),
  not observed zeroes.

The selected fee-output sum matches the consumer API exactly. USD valuation
uses `raw amount / 10^asset_decimals * published UTC end-of-day asset price`.
The asset for these reports is USDC with six decimals.

## On-chain evidence

At Ethereum block **26,151,802**, the base vault's `accountant()` is
`0xAaaFEa48472f77563961Cdb53291DEDfB46F9040`, the current Locked yvUSD contract.
Its `feeConfig()` returned:

| Component | Basis points |
| --- | ---: |
| Management fee | 0 |
| Performance fee | 0 |
| Locker bonus | 1000 |

The `FeesReported(uint256,uint256,uint256)` event has indexed fields
`managementFee`, `performanceFee`, and `lockerBonus`. Sample receipts and
historical contract reads distinguish these components:

| UTC date | Block | Management (USDC) | Performance (USDC) | Locker bonus (USDC) | Vault-reported total (USDC) |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2026-01-26 | 24,322,233 | 0.078666 | 0.624907 | 0.624907 | 1.328480 |
| 2026-03-21 | 24,702,728 | 0 | 0 | 7.462307 | 7.462307 |
| 2026-10-08 | 26,145,498 | 0 | 0 | 25.035988 | 25.035988 |

Transactions:

- [January report](https://etherscan.io/tx/0x4b3db111e3e62161a36b4cee6ef2f81fb1aa63cff4ce966174ad4642ae501aea#eventlog):
  `StrategyReported` log 3354; preceding `FeesReported` log 3351.
  The historical accountant was the earlier Locked yvUSD contract
  `0xAb9018A699003a777d690c156045DfC4A7ef3A96`, with configuration
  25 management, 1000 performance, and 1000 locker-bonus basis points.
- [March report](https://etherscan.io/tx/0x11af8bfe888c086a7bda106eb876242849a33f9d69638b8505883fef8daba2fe#eventlog):
  report log 7; preceding fee-split log 4. The current locked contract's
  configuration at that block was 0 management, 0 performance, and 1500
  locker-bonus basis points.
- [October report](https://etherscan.io/tx/0x27028642df106020fced699b44a80eb43aac5b1ff4764b80401c3ac47b922d13#eventlog):
  report log 1389; preceding fee-split log 1386. The entire vault-reported
  amount is explicitly a locker bonus; management and performance are zero.

These are representative receipts, not a completed decomposition of all 438
rows. The corrected historical fee total has not been calculated. Current
configuration cannot establish historical fees: both the accountant and the
rates changed. Do not subtract a fixed 10% or zero the entire vault history.

## Backend correction

1. Classify yvUSD accountant distributions using the historical accountant
   and transaction-bound `FeesReported` evidence. Match the corresponding
   strategy report within each receipt; one transaction can contain multiple
   reports. Preserve incomplete/unavailable evidence states.
2. Preserve the original vault-reported total as raw evidence. Store actual
   management/performance fees and locker-bonus redistribution separately.
   Reconcile the components to the final vault report, including any protocol
   fee or rounding/capping adjustments rather than assuming quoted and final
   amounts always agree.
3. Exclude verified locker-bonus redistribution from the fee metric used by
   Powerglove. Preserve genuine historical fees and expose the redistribution
   separately, for example as `lockerBonusUsd`.
4. Revalue and publish corrected summary, history, and vault totals under one
   new dataset identity. Check the allocator, chain/type, headline, and
   fee-per-TVL views against the same publication.
5. Preserve the existing reported-P&L earnings policy; this investigation
   does not redefine earnings or consolidate nested vault economics.

Relevant producer code: `yearn_data/fees.py:normalize_allocator_fees`,
`yearn_data/fee_valuation.py:usd_amount`, and `yearn_data/pairing.py:FEE_FIELDS`.
The [APR integration](https://github.com/yearn/yearn-yvusd-apr-service/blob/main/lib/onchain.ts)
already reads management, performance, and locker-bonus rates as separate
fields.

No accounting or frontend fee-exclusion code was changed by this investigation.
