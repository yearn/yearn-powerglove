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
   after settling and reporting. Original unlocked balance is total TVL minus locked TVL. Original locked USD share price is
   underlying yvUSD PPS times locked-vault PPS. For each original vault, inferred net flow is
   `TVL[t] - TVL[t-1] * originalUsdPps[t] / originalUsdPps[t-1]`.
   This is an estimate from daily observations, not a reconstruction of individual transfers or their intraday timing.
   Report refresh timing, price changes, or rewards can influence the residual. Equity receives no external flows.
   Missing/duplicate required daily observations stop generation rather than becoming zero cash flow.
2. Accrue each unpaused tranche's target on its baseline, using the contract's 31,556,952 seconds/year,
   integer per-second WAD rate, and integer division.
3. Compare pool assets with accrued baseline plus pending excess. Positive excess is assigned by the configured shares.
4. A shortfall consumes Equity, Junior, then Senior; pending excess precedes baseline within each tranche.
   Any affected tranche pauses target accrual. A strictly profitable settlement resumes paused tranches without retroactive accrual.
5. Report immediately after each daily settlement, realizing pending excess into baseline, with zero profit-unlock delay.
   This assumption intentionally produces economic NAV rather than reproducing a deployed Yearn profit-locking schedule.

Pool assets equal total tranche claims plus an explicitly recorded rounding residue. There are no fabricated capital inflows
to fund targets. A target can consume lower-priority principal when underlying gains are insufficient.

The accounting engine starts every tranche at a normalized $1 share price. Deposits mint shares and withdrawals
burn shares at the current simulated price, so capital movements change TVL without changing returns.
Earnings are ending capital minus initial capital minus cumulative net flows; cumulative return is share-price growth,
not ending TVL divided by initial TVL. Cumulative returns are not annualized. Rolling APYs use 365 days
to match existing charts; the 5% contractual target remains a nominal annual rate, not a guaranteed APY.
The standalone model's initial 7/30-day windows remain unavailable until enough simulated observations exist.
The displayed charts prepend real vault history and calculate rolling windows across the migration boundary.
All three displayed chart histories start on April 11, 2026. Older inputs remain available for rolling-return calculations;
this display cutoff does not change migration balances, the August 1 switch, or simulation results.
Senior uses original unlocked PPS and TVL (total minus locked). Junior uses original locked TVL and USD-valued locked PPS,
following the paired yvUSD chart convention. Published Senior 7/30-day APYs before migration remain unchanged.
The simulated share curve is multiplied by the original August 1 PPS to avoid a price-reset return at migration.
TVL correctly reflects the one-time $1M reallocation at the switch. Each chart marks August 1; earlier observations are actual,
while later values are simulated. The three-month summary remains limited to post-migration performance.
APYs are canonicalized to ten decimal places as decimal rates to avoid insignificant Bun/Node exponentiation differences;
all NAV accounting remains integer based.

## Files and regeneration

- `src/mock-data/tranche-config.json`: editable migration shifts, date boundaries, targets, and excess shares.
- `src/mock-data/tranche-source.json`: captured full pre-migration and daily replay TVL/PPS/APY histories, retrieval timestamp, endpoint hashes, controller commit/hash.
- `src/mock-data/tranche-simulation.json`: generated daily NAV, normalized PPS, returns, APYs, target accrual,
  losses, excess allocation, daily/cumulative net flows, share supplies, pause states, and pool rounding residues for all three tranches.
- `src/lib/tranche-simulation.ts`: pure accounting engine.

Run `bun run simulate:tranches` to regenerate locally without network access. The result includes source/config and engine hashes.
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
