import type { CanonicalFeeHistory } from './canonical-fees'
import { canonicalDecimalToNumber, type FeeHistoryPeriod, feeHistoryBoundary } from './fee-history'

export interface ChainFeeHistory {
  chainId: number
  history: CanonicalFeeHistory
}

export type ChainFeeMetric = 'earnings' | 'fees'

export interface ChainFeeHistoryPoint {
  period: string
  earnings: Record<string, number | null>
  fees: Record<string, number | null>
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
      // The API omits inactive periods but returns null when a reported amount is unavailable.
      point.earnings[chainId] = bucket ? canonicalDecimalToNumber(bucket.lifetimeEarnings.netYieldUsd) : 0
      point.fees[chainId] = bucket ? canonicalDecimalToNumber(bucket.totalFeesPaidUsd) : 0
    }
    return point
  })
  const first = periods[0]
  if (!first) return { periodic, cumulative: [] }

  const totals: Record<ChainFeeMetric, Record<number, number | null>> = { earnings: {}, fees: {} }
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
        const total = totals[metric][chainId]
        const amount = point[metric][chainId]
        totals[metric][chainId] = total === null || amount === null ? null : total + amount
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
