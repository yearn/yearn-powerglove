import type { CanonicalFeeHistory } from './canonical-fees'
import { canonicalDecimalToNumber, type FeeHistoryPeriod, feeHistoryBoundary } from './fee-history'

export interface ChainFeeHistory {
  chainId: number
  history: CanonicalFeeHistory
}

export type ChainFeeMetric = 'earnings' | 'fees'

export interface ChainFeeHistoryPoint {
  period: string
  earnings: Record<number, number>
  fees: Record<number, number>
}

export function buildChainFeeHistorySeries(histories: ChainFeeHistory[], periods: FeeHistoryPeriod[]) {
  const indexed = histories.map(({ chainId, history }) => ({
    chainId,
    buckets: new Map(history.buckets.map((bucket) => [bucket.period, bucket]))
  }))
  const periodic = periods.map(({ period }): ChainFeeHistoryPoint => {
    const point: ChainFeeHistoryPoint = { period, earnings: {}, fees: {} }
    for (const { chainId, buckets } of indexed) {
      const bucket = buckets.get(period)
      // Missing amounts contribute zero in the chain breakdown charts.
      point.earnings[chainId] = canonicalDecimalToNumber(bucket?.lifetimeEarnings.netYieldUsd ?? null) ?? 0
      point.fees[chainId] = canonicalDecimalToNumber(bucket?.totalFeesPaidUsd ?? null) ?? 0
    }
    return point
  })
  const first = periods[0]
  if (!first) return { periodic, cumulative: [] }

  const totals: Record<ChainFeeMetric, Record<number, number>> = { earnings: {}, fees: {} }
  for (const { chainId } of histories) {
    totals.earnings[chainId] = 0
    totals.fees[chainId] = 0
  }
  const opening: ChainFeeHistoryPoint = {
    period: feeHistoryBoundary(first, 'start'),
    earnings: { ...totals.earnings },
    fees: { ...totals.fees }
  }
  const cumulative = periodic.map((point, index): ChainFeeHistoryPoint => {
    for (const metric of ['earnings', 'fees'] as const) {
      for (const { chainId } of histories) {
        totals[metric][chainId] += point[metric][chainId]
      }
    }
    return {
      period: feeHistoryBoundary(periods[index], 'end'),
      earnings: { ...totals.earnings },
      fees: { ...totals.fees }
    }
  })
  return { periodic, cumulative: [opening, ...cumulative] }
}
