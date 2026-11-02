# yvUSD migration counterfactual

This is simulated economic accounting, not a deployed tranche history, a prediction, or actual onchain transactions.
The mock pages and pinned list rows consume the same frozen dataset. Normal vault pages retain their original live data.

## Scenario

The replay runs from August 1, 2026 at 00:00 UTC through November 1 at 00:00 UTC:
93 observations and 92 daily return intervals. Both migration TVL observations must be exactly on August 1.

| Migration balance | USD |
| --- | ---: |
| Original yvUSD total, including locked capital | 9,059,598.527179526 |
| Original locked yvUSD | 2,985,871.7235816075 |
| Senior: total minus locked minus $1M | 5,073,726.803598 |
| Junior: locked plus $750K | 3,735,871.723581 |
| Equity | 250,000 |

Accounting floors the source balances to six-decimal USDC units. Migration conserves that total exactly.
USDC is valued at $1, migration has no slippage/cost, and subsequent daily net deposits/withdrawals are inferred from observed vault TVL and PPS.
All capital earns the same historical underlying yvUSD share-price return. Original locked share returns are not
added again, because the new waterfall replaces that economic structure.

Senior and Junior have 500 BPS annual target rates. Equity has no target. Excess shares are 0/8000/2000 BPS.
Equity is invested first-loss capital; the separate reserve is zero. There are no additional tranche fees.
Fees already embedded in the underlying PPS are not deducted twice.

## Accounting rules

The engine ports the economic settlement rules from
[TrancheController at 58182cf](https://github.com/yearn/ytranche/blob/58182cf41f38aa86365942a23af4876fbd76fca2/src/TrancheController.sol).
The [system overview](https://gov.yearn.fi/t/yip-91-ytranche/14659) and attached HTML simulator explain the intended profiles;
the controller supplies the path-dependent accounting rules.

1. Grow the prior simulated pool by the daily underlying PPS ratio. Replay original Senior/Junior net cash flows at end of day,
   after any scheduled settlement and report. Original unlocked balance is total TVL minus locked TVL. Original locked USD share price is
   underlying yvUSD PPS times locked-vault PPS. For each original vault, inferred net flow is
   `TVL[t] - TVL[t-1] * originalUsdPps[t] / originalUsdPps[t-1]`.
   This is an estimate from daily observations, not a reconstruction of individual transfers or their intraday timing.
   Report refresh timing, price changes, or rewards can influence the residual. Equity receives no external flows.
   Missing/duplicate required daily observations stop generation rather than becoming zero cash flow.
2. Settle every seven days from August 1 (first settlement August 8), plus a final one-day settlement on November 1: 14 settlements total. Accrue each unpaused tranche's target on its baseline, using the contract's 31,556,952 seconds/year,
   integer per-second WAD rate, and integer division.
3. Compare pool assets with accrued baseline plus pending excess. Positive excess is assigned by the configured shares.
4. A shortfall consumes Equity, Junior, then Senior; pending excess precedes baseline within each tranche.
   Any affected tranche pauses target accrual. A strictly profitable settlement resumes paused tranches without retroactive accrual.
5. Report immediately after each weekly settlement, realizing controller excess into economic baseline.
   Junior and Equity use seven-day profit unlocking; Senior has no profit lock. Only reported excess is locked:
   target accrual is live. The share model follows the fee-free report/loss accounting in
   [TokenizedStrategy 8c8929f](https://github.com/yearn/tokenized-strategy/blob/8c8929f1878e8c5ad78aa0a6dabc877a890f68d9/src/TokenizedStrategy.sol),
   the exact submodule revision pinned by the controller repository.

## Profit unlocking and displayed values

Reported excess mints vault-owned shares at the pre-report price. Those shares leave effective supply linearly over
seven days, releasing their value to holders without an immediate price jump. Overlapping reports blend the
remaining share-weighted lock duration with seven days for new profits, matching TokenizedStrategy.
A net accounting loss burns the remaining locked shares first; an uncovered loss reduces holder PPS.
Already-unlocked profit is not re-locked. Target gains continue to accrue independently of this excess lock.

TVL and economic earnings include all economically booked profits, including the locked amount. Chart PPS,
cumulative share return, and rolling APYs use holder shares plus still-locked shares as the effective supply.
The summary lists locked profits separately. Junior/Equity deposits mint at this effective PPS, and withdrawals
burn at this PPS (rounded up). This can change the distribution of future profits between depositors compared with
the zero-unlock scenario, even though the controller's economic TVL and dollar earnings are unchanged.

The dataset exposes `lockedSharesUnits`, `effectiveSharesUnits`, `lockedProfitsUsd`, and `unlockedAssetsUsd`,
alongside total `nav` and `earningsUsd`. `pps`/`cumulativeReturn` are the unlocked share-price measures;
`economicPps` is the hypothetical value of all economic assets per holder share if the current lock were removed.
Profit unlock durations are parameterized per tranche in `profitUnlockDays`. Shares retain the model's normalized
18-decimal precision; this is a fee-free economic replay, not an exact deployed token balance reconstruction.

Pool assets equal total tranche claims plus an explicitly recorded rounding residue. There are no fabricated capital inflows
to fund targets. A target can consume lower-priority principal when underlying gains are insufficient.

The accounting engine starts every tranche at a normalized $1 share price. Deposits mint shares and withdrawals
burn shares at the current simulated price, so capital movements change TVL without changing returns.
Earnings are ending capital minus initial capital minus cumulative net flows; cumulative return is share-price growth,
not ending TVL divided by initial TVL. Cumulative returns are not annualized. Rolling APYs use 365 days
to match existing charts; the 5% contractual target remains a nominal annual rate, not a guaranteed APY.
The standalone model's initial 7/30-day windows remain unavailable until enough simulated observations exist.
The displayed charts prepend real vault history and calculate rolling windows across the migration boundary.
Displayed chart history is limited to April 11, 2026 onward; Equity starts at the August 1 migration. Older inputs remain available for rolling-return calculations;
this display cutoff does not change migration balances, the August 1 switch, or simulation results.
Senior uses original unlocked PPS and TVL (total minus locked). Junior uses original locked TVL and USD-valued locked PPS,
following the paired yvUSD chart convention. Published Senior 7/30-day APYs before migration remain unchanged.
The simulated share curve is multiplied by the original August 1 PPS to avoid a price-reset return at migration.
TVL correctly reflects the one-time $1M reallocation at the switch. Each chart marks August 1; earlier observations are actual,
while later values are simulated. The three-month summary remains limited to post-migration performance.
APYs are canonicalized to ten decimal places as decimal rates to avoid insignificant Bun/Node exponentiation differences;
all NAV and share accounting remains integer based.

## Files and regeneration

- `src/mock-data/tranche-config.json`: editable migration shifts, date boundaries, settlement cadence, per-tranche unlock durations, targets, and excess shares.
- `src/mock-data/tranche-source.json`: captured full pre-migration and daily replay TVL/PPS/APY histories, retrieval timestamp, endpoint hashes, controller commit/hash.
- `src/mock-data/tranche-simulation.json`: generated daily NAV, normalized PPS, returns, APYs, target accrual,
  losses, excess allocation, daily/cumulative net flows, share supplies, pause states, and pool rounding residues for all three tranches.
- `src/lib/tranche-simulation.ts`: pure accounting engine.

Run `bun run simulate:tranches` to regenerate locally without network access. The result includes source/config and engine hashes.
Between settlements, charts show target-accrued claims, without attributing unsettled profits or losses to Equity. The signed `unsettledPnlUnits` reconciles pool assets to these claims; `roundingResidualUnits` applies only on settlement dates. Daily deposits and withdrawals accrue the affected tranche and mint/burn at its current effective share price, including the remaining profit-lock shares.

An intentional source refresh uses `python3 scripts/fetch-tranche-history.py`; review changes before regenerating.
Dates require exact daily coverage: missing, duplicate, invalid, or out-of-order observations stop generation.

The collapsed floating mockup notice links to downloadable inputs and the complete generated dataset.
Pages show simulated endpoint TVL, last-day annualized return, rolling 7/30-day APYs, and a three-tranche outcome table.
The list leaves forward estimates unavailable because this replay does not predict future yields.
The original live strategy and activity panels remain available on the mock pages; the floating mockup notice distinguishes them from simulated returns. The migration summary appears below those panels at the bottom of the page.

## Validation

Behavior tests cover known 80/20 excess allocation, loss priority, funding targets from lower-priority capital,
pause/resume, missing input rejection, migration conservation, every day's pool/claim equality, rolling-window
availability, and exact regeneration from frozen inputs. Inputs and all output downloads remain available for review. Cash-flow regressions verify that deposits/withdrawals create no return, original locked gains are not counted as deposits, and the real-to-simulated chart splice is continuous.

Profit-lock tests cover full expiry, gradual unlocking, live targets, overlapping reports, loss buffering, remaining endpoint locks, unchanged economic NAV/Senior results, and chart use of unlocked PPS.

## Allocation health: actual exposures, illustrative risk

The Allocation health tab sits next to Current Strategy Allocations on the tranche mock pages.
The panel uses actual yvUSD currentDebtUsd positions captured from Kong in
src/mock-data/tranche-allocation-exposures.json. The receipt records observed block/time,
retrieval time, source URL and raw-response hash. The panel omits the snapshot metadata row.
It is a captured snapshot, not a continuously refreshed feed. Refresh intentionally with
python3 scripts/fetch-tranche-allocation-exposures.py; review changes before committing.
The capture rejects missing USD values, unknown funded strategies, duplicate entries and
incomplete debt coverage. Its denominator is strategy debt plus idle at the same asset price,
not a potentially older TVL history row.

Actual USD debts are not rescaled to the simulated tranche AUM. Dependency concentration
uses the captured actual allocation total; dependency loss caps use the simulated November 1
Junior + Equity capital, excluding the illustrative $150K cooldown queue. The panel is an
explicit hybrid scenario, not an assessment that these allocations existed at the simulation
endpoint or a verified statement about actual tranche compliance.

Dependency mappings and loss rates remain illustrative inputs in
src/mock-data/tranche-allocation-inputs.json. Each actual position is counted once per mapped
dependency; shared dependencies overlap. Gross leverage, collateral look-through, curators,
oracles and exit discounts are not measured. Accordingly, position debt is an exposure proxy,
not proof of complete dependency exposure. The two funded Pendle positions are aggregated.
Cumulative risk-group exposure also uses actual debts, counted once per band using mock dependency risk scores. Yields, stress losses, liquidity, holder data and controls remain mock inputs.
None of these inputs changes the return simulation.

Rule 5 remains unresolved: written guidelines specify 25% of 60-day obligations locked in,
while upstream rules.yaml specifies 50% at the pinned policy revision. Its mock $30K income
input does not resolve that discrepancy. Profit-unlock balances are not future locked income.
A verified assessment should eventually come from the upstream evaluator with complete and
consistent actual inputs, confirmed policy, and its own date and coverage.
