import type { ChartDateRange } from '@/components/charts/chart-utils'
import type { CanonicalFeeHistoryBucket } from './canonical-fees'
import { completedFeeHistoryBuckets, feeHistoryBoundary } from './fee-history'

const DAY_MS = 86400000

export function feeRangeDay(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) / DAY_MS
}

export function feeRangeDate(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10)
}

export function feeSliderBounds(buckets: CanonicalFeeHistoryBucket[], now: number): ChartDateRange | null {
  const completed = completedFeeHistoryBuckets(buckets, now)
  if (!completed.length) return null
  const starts = completed.map((bucket) => feeRangeDay(feeHistoryBoundary(bucket, 'start')))
  const ends = completed.map((bucket) => feeRangeDay(feeHistoryBoundary(bucket, 'end')))
  return {
    start: feeRangeDate(Math.min(...starts)),
    end: feeRangeDate(Math.max(...ends) - 1)
  }
}

export function feeSliderValues(bounds: ChartDateRange, selected: ChartDateRange | null): [number, number] {
  const min = feeRangeDay(bounds.start)
  const max = feeRangeDay(bounds.end)
  const clamp = (day: number) => Math.max(min, Math.min(max, day))
  return [clamp(feeRangeDay(selected?.start ?? bounds.start)), clamp(feeRangeDay(selected?.end ?? bounds.end))]
}

export function feeSliderTicks(bounds: ChartDateRange) {
  const min = feeRangeDay(bounds.start)
  const span = feeRangeDay(bounds.end) - min
  const firstYear = Number(bounds.start.slice(0, 4))
  const lastYear = Number(bounds.end.slice(0, 4))
  return Array.from({ length: lastYear - firstYear + 1 }, (_, index) => {
    const year = firstYear + index
    return { year, position: ((feeRangeDay(`${year}-01-01`) - min) / span) * 100 }
  }).filter(({ position }) => position >= 15 && position <= 85)
}
