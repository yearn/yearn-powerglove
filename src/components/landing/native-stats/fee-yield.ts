import type { FeeHistoryPoint } from './fee-history'
import { feeHistoryBoundary } from './fee-history'

const DAY_SECONDS = 86400
const YEAR_DAYS = 365
export type TvlYieldMetric = 'fees' | 'earnings'

export interface DailyFeeTvlHistory {
  datasetId: string
  interval: string
  chart: Array<{ timestamp: number; [series: string]: number | null }>
}

export interface TvlYieldPoint {
  period: string
  amountUsd: number | null
  averageTvlUsd: number | null
  annualizedYieldPct: number | null
  coveredDays: number
  expectedDays: number
  cumulativeAmountUsd: number | null
  cumulativeAverageTvlUsd: number | null
  cumulativeDays: number
  cumulativeAnnualizedYieldPct: number | null
}

export function buildTvlYieldSeries(
  periods: FeeHistoryPoint[],
  history: DailyFeeTvlHistory,
  seriesKey?: string,
  metric: TvlYieldMetric = 'fees'
): TvlYieldPoint[] {
  const days = new Map<number, { timestamp: number; tvl: number | null }>()
  for (const row of history.chart) {
    const day = Math.floor(row.timestamp / DAY_SECONDS)
    if ((days.get(day)?.timestamp ?? -Infinity) > row.timestamp) continue
    const values = seriesKey
      ? [row[seriesKey] ?? null]
      : Object.entries(row)
          .filter(([key]) => key !== 'timestamp')
          .map(([, value]) => value)
    const valid =
      values.length > 0 && values.every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0)
    days.set(day, {
      timestamp: row.timestamp,
      tvl: valid ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null
    })
  }

  let cumulativeAmount = 0
  let cumulativeTvlDays = 0
  let cumulativeDays = 0
  let cumulativeAvailable = true
  return periods.map((point) => {
    const start = point.startTimestamp ?? Date.parse(feeHistoryBoundary(point, 'start')) / 1000
    const end = point.endTimestamp ?? Date.parse(feeHistoryBoundary(point, 'end')) / 1000
    const firstDay = Math.floor(start / DAY_SECONDS)
    const expectedDays = Math.max(0, Math.ceil(end / DAY_SECONDS) - firstDay)
    let tvlDays = 0
    let coveredDays = 0
    for (let day = firstDay; day < firstDay + expectedDays; day++) {
      const value = days.get(day)?.tvl
      if (value != null) {
        tvlDays += value
        coveredDays++
      }
    }
    const averageTvlUsd = coveredDays === expectedDays && expectedDays > 0 ? tvlDays / expectedDays : null
    const amountUsd = metric === 'earnings' ? point.netYieldUsd : point.totalFeesPaidUsd
    const validAmount = amountUsd !== null && Number.isFinite(amountUsd)
    const annualizedYieldPct =
      validAmount && averageTvlUsd !== null && averageTvlUsd > 0
        ? (amountUsd / averageTvlUsd) * (YEAR_DAYS / expectedDays) * 100
        : null
    cumulativeAvailable = cumulativeAvailable && validAmount && averageTvlUsd !== null
    if (cumulativeAvailable) {
      cumulativeAmount += amountUsd ?? 0
      cumulativeTvlDays += tvlDays
      cumulativeDays += expectedDays
    }
    const cumulativeAverageTvlUsd =
      cumulativeAvailable && cumulativeDays > 0 ? cumulativeTvlDays / cumulativeDays : null
    return {
      period: point.period,
      amountUsd,
      averageTvlUsd,
      annualizedYieldPct,
      coveredDays,
      expectedDays,
      cumulativeAmountUsd: cumulativeAvailable ? cumulativeAmount : null,
      cumulativeAverageTvlUsd,
      cumulativeDays,
      cumulativeAnnualizedYieldPct:
        cumulativeAverageTvlUsd !== null && cumulativeAverageTvlUsd > 0
          ? (cumulativeAmount / cumulativeAverageTvlUsd) * (YEAR_DAYS / cumulativeDays) * 100
          : null
    }
  })
}
