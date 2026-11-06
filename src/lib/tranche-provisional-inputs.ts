import { getStrategyDetailConfig } from '@/components/strategy-details/strategyDetailRegistry'
import { YVUSD_STRATEGY_ADDRESSES } from '@/constants/yvUsdStrategies'
import type { StrategyRating } from '@/lib/tranche-allocation-health'
import { dependencyPositionLoss, policyLossRate } from '@/lib/tranche-dependency-loss'
import type { MorphoVaultLookthrough, PawnLooperRates } from '@/lib/yvusd-reporting-client'
import exposures from '@/mock-data/tranche-allocation-exposures.json'
import inputs from '@/mock-data/tranche-allocation-inputs.json'

export type TrancheMeasurements = {
  pawn?: PawnLooperRates
  morpho?: MorphoVaultLookthrough
}

/** Current measurements applied to frozen capital: a provisional scenario, not a dated audit. */
export function buildProvisionalDependencyLoss(
  ratings: Record<string, StrategyRating>,
  measurements: TrancheMeasurements = {}
) {
  const positions = exposures.strategies.flatMap((strategy) => {
    const address = strategy.address.toLowerCase()
    const config = getStrategyDetailConfig(1, address)
    const isPawn = address === YVUSD_STRATEGY_ADDRESSES.pawn
    const isMorpho = address === YVUSD_STRATEGY_ADDRESSES.morpho
    const direct = config?.template === 'morpho-compounder' || config?.template === 'pendle'
    const leverage = isPawn ? (measurements.pawn?.leverage ?? null) : direct ? 1 : null
    const leverageSource = isPawn
      ? measurements.pawn
        ? `QTOV onchain · block ${measurements.pawn.blockNumber} · ${measurements.pawn.observedAt}`
        : 'QTOV looper measurement missing'
      : direct
        ? 'QTOV strategy type · provisional 1× direct position'
        : 'Underlying leverage not established'
    const mapping = inputs.strategyDependencies[address as keyof typeof inputs.strategyDependencies] ?? []
    const links = mapping.map((dependency) => ({
      dependency,
      // Katana's underlying Morpho share and Grove's issuer exposure require deeper look-through.
      weight:
        (address === YVUSD_STRATEGY_ADDRESSES.katana && dependency === 'Morpho') ||
        (address === YVUSD_STRATEGY_ADDRESSES.grove && dependency === 'Sky / USDS')
          ? null
          : 1,
      weightSource: 'QTOV type + provisional mapping · assumed 100% share; idle not measured'
    }))
    if (isMorpho && measurements.morpho) {
      const byCollateral = new Map<string, { symbol: string; share: number }>()
      for (const market of measurements.morpho.markets) {
        const key = market.collateralAddress.toLowerCase()
        const previous = byCollateral.get(key)
        byCollateral.set(key, {
          symbol: market.collateralSymbol,
          share: (previous?.share ?? 0) + market.allocationShare
        })
      }
      for (const [collateral, position] of byCollateral) {
        links.push({
          dependency: `Morpho collateral · ${position.symbol} (${collateral.slice(0, 8)})`,
          weight: position.share,
          weightSource: `QTOV Morpho market allocation · ${measurements.morpho.fetchedAt}`
        })
      }
    }
    return links.map((link) => ({
      ...link,
      strategy,
      leverage,
      leverageSource,
      score: ratings[address]?.score ?? null,
      ratingState: ratings[address]?.state ?? 'missing',
      ratingObservedAt: ratings[address]?.observedAt ?? null,
      weightSource: link.weight === null ? 'Look-through share missing' : link.weightSource
    }))
  })
  const dependencies = [...new Set(positions.map((position) => position.dependency))].map((name) => {
    const links = positions.filter((position) => position.dependency === name)
    const scores = links.flatMap((link) => (policyLossRate(link.score) === null ? [] : [link.score as number]))
    const score = scores.length ? Math.max(...scores) : null
    const modeled = links.map((link) => ({
      ...link,
      // This output deliberately excludes exit loss; the full assessment still requires exit evidence.
      baseLoss: dependencyPositionLoss({
        capital: link.strategy.allocationUsd,
        score,
        leverage: link.leverage,
        weight: link.weight,
        exitDiscount: 0
      })
    }))
    const known = modeled.flatMap((link) => (link.baseLoss === null ? [] : [link.baseLoss]))
    const baseLoss = known.length ? known.reduce((sum, value) => sum + value, 0) : null
    return {
      name,
      score,
      lossRate: policyLossRate(score),
      links: modeled,
      baseLoss,
      complete: scores.length === links.length && known.length === links.length,
      missingRatings: links.filter((link) => policyLossRate(link.score) === null).map((link) => link.strategy.name)
    }
  })
  const knownLosses = dependencies.flatMap((dependency) => (dependency.baseLoss === null ? [] : [dependency.baseLoss]))
  return { dependencies, maxKnownBaseLoss: knownLosses.length ? Math.max(...knownLosses) : null }
}
