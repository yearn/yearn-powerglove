import type { CanonicalFeeHistory, CanonicalVaultFee } from './canonical-fees'
import { canonicalDecimalToNumber, type FeeHistoryPeriod, feeHistoryBoundary } from './fee-history'

export interface VaultComparisonPoint {
  period: string
  earnings: Record<string, number | null>
  fees: Record<string, number | null>
}

const WEEK = 7 * 86400
const MONDAY_OFFSET = 3 * 86400

export function allocatorMovingAverageWindow(query: string, now: number) {
  const params = new URLSearchParams(query)
  const since = Number(params.get('since') ?? 0)
  const until = Math.min(Number(params.get('until') ?? now), now)
  // Use full Monday-to-Monday UTC weeks inside the selected range.
  const first = Math.ceil((since + MONDAY_OFFSET) / WEEK) * WEEK - MONDAY_OFFSET
  const end = Math.floor((until + MONDAY_OFFSET) / WEEK) * WEEK - MONDAY_OFFSET
  const start = Math.max(0, first - 3 * WEEK)
  const periods: FeeHistoryPeriod[] = []
  for (let timestamp = start; first < end && timestamp < end; timestamp += WEEK) {
    periods.push({
      period: new Date(timestamp * 1000).toISOString().slice(0, 10),
      startTimestamp: timestamp,
      endTimestamp: timestamp + WEEK
    })
  }
  params.set('interval', 'weekly')
  params.set('since', String(start))
  params.set('until', String(end))
  return { query: params.toString(), periods, first }
}

export function fourWeekVaultMovingAverage(points: VaultComparisonPoint[]): VaultComparisonPoint[] {
  return points.map((point, index) => {
    const average = (metric: 'earnings' | 'fees') =>
      Object.fromEntries(
        Object.keys(point[metric]).map((key) => {
          const values = points.slice(Math.max(0, index - 3), index + 1).map((row) => row[metric][key])
          return [
            key,
            values.length === 4 && values.every((value) => value != null)
              ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0) / 4
              : null
          ]
        })
      )
    return { period: point.period, earnings: average('earnings'), fees: average('fees') }
  })
}

export const allocatorKey = (vault: Pick<CanonicalVaultFee, 'chainId' | 'address'>) =>
  `${vault.chainId}:${vault.address.toLowerCase()}`

export function rankAllocators(vaults: CanonicalVaultFee[], metric: 'fees' | 'earnings') {
  const amount = (vault: CanonicalVaultFee) =>
    canonicalDecimalToNumber(metric === 'fees' ? vault.totalFeesPaidUsd : vault.lifetimeEarnings.netYieldUsd)
  return vaults
    .filter((vault) => vault.contractFamily === 'yearn-v3-allocator')
    .sort(
      (a, b) => (amount(b) ?? -Infinity) - (amount(a) ?? -Infinity) || allocatorKey(a).localeCompare(allocatorKey(b))
    )
}

export function buildVaultFeeHistorySeries(
  histories: Array<{ key: string; history?: CanonicalFeeHistory }>,
  periods: FeeHistoryPeriod[]
) {
  const indexed = histories.map(({ key, history }) => ({
    key,
    available: history !== undefined,
    buckets: new Map(history?.buckets.map((bucket) => [bucket.period, bucket]) ?? [])
  }))
  const periodic = periods.map(({ period }): VaultComparisonPoint => {
    const point: VaultComparisonPoint = { period, earnings: {}, fees: {} }
    for (const { key, available, buckets } of indexed) {
      const bucket = buckets.get(period)
      // No reports in an available history is zero; unvalued reports remain unknown.
      point.earnings[key] = !available
        ? null
        : bucket
          ? canonicalDecimalToNumber(bucket.lifetimeEarnings.netYieldUsd)
          : 0
      point.fees[key] = !available ? null : bucket ? canonicalDecimalToNumber(bucket.totalFeesPaidUsd) : 0
    }
    return point
  })
  const opening: VaultComparisonPoint = {
    period: periods[0] ? feeHistoryBoundary(periods[0], 'start') : '',
    earnings: {},
    fees: {}
  }
  for (const { key, available } of indexed) {
    opening.earnings[key] = available ? 0 : null
    opening.fees[key] = available ? 0 : null
  }
  const totals = { earnings: { ...opening.earnings }, fees: { ...opening.fees } }
  const cumulative = periodic.map((point, index): VaultComparisonPoint => {
    for (const metric of ['earnings', 'fees'] as const) {
      for (const { key } of indexed) {
        const value = point[metric][key]
        const previous = totals[metric][key]
        totals[metric][key] = value === null || previous === null ? null : previous + value
      }
    }
    return {
      period: feeHistoryBoundary(periods[index], 'end'),
      earnings: { ...totals.earnings },
      fees: { ...totals.fees }
    }
  })
  return { periodic, cumulative: periods.length ? [opening, ...cumulative] : [] }
}
