import type { ConstantPriceTvlHistory, TvlHistoryChartRow } from './types'

export const DAY_SECONDS = 86_400
export const PRICE_NEUTRAL_TOTAL_SERIES = 'Price-neutral TVL'
export const ACTUAL_TOTAL_SERIES = 'Actual TVL'

export type TvlHistoryBreakdown = 'vault' | 'chain' | 'category'
export type ChainTvlHistoryBreakdown = Extract<TvlHistoryBreakdown, 'vault' | 'category'>
export type OverallTvlHistoryBreakdown = Extract<TvlHistoryBreakdown, 'chain' | 'category'>
export type TvlHistoryRange = '365d' | 'all'
export type TvlHistoryMetric = 'actual' | 'constant-price'

export const TVL_HISTORY_RANGE_OPTIONS: Array<{ value: TvlHistoryRange; label: string; days?: number }> = [
  { value: '365d', label: '1 Year', days: 365 },
  { value: 'all', label: 'All Time' }
]

export function buildTvlHistoryUrl({
  breakdown,
  mode,
  interval
}: {
  breakdown: TvlHistoryBreakdown
  mode: 'raw' | 'external'
  interval: 'daily' | '3day' | 'weekly'
}): string {
  return `/api/tvl/history/runs/latest?groupBy=${breakdown}&mode=${mode}&interval=${interval}`
}

export function getTvlHistoryRangeBounds(
  range: TvlHistoryRange,
  endTimestamp: number,
  allTimeStartTimestamp: number
): { from: number; to: number } {
  const option = TVL_HISTORY_RANGE_OPTIONS.find((item) => item.value === range)
  return {
    from: option?.days ? endTimestamp - option.days * DAY_SECONDS : allTimeStartTimestamp,
    to: endTimestamp
  }
}

export function buildConstantPriceTvlUrl({ from, to }: { from: number; to: number }): string {
  return `/api/tvl/history/runs/latest/constant-price?mode=external&groupBy=chain&interval=weekly&from=${from}&to=${to}`
}

export function buildChainTvlHistoryUrl({
  breakdown,
  chainId,
  from,
  to
}: {
  breakdown: ChainTvlHistoryBreakdown
  chainId: number
  from: number
  to: number
}): string {
  return `/api/tvl/history/runs/latest/constant-price?mode=external&groupBy=${breakdown}&interval=weekly&chainId=${chainId}&from=${from}&to=${to}&includeCurrent=true&format=chart${breakdown === 'vault' ? '&top=10' : ''}`
}

export function selectConstantPriceChart(
  history: ConstantPriceTvlHistory,
  metric: TvlHistoryMetric
): TvlHistoryChartRow[] {
  return metric === 'constant-price' ? history.constantPriceChart : history.actualChart
}

export function getAvailableChartSeries(rows: TvlHistoryChartRow[]): string[] {
  const series = new Set<string>()
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (key !== 'timestamp' && typeof value === 'number' && Number.isFinite(value)) series.add(key)
    }
  }
  return [...series]
}

export function getAvailableRowTotal(row: TvlHistoryChartRow, series: string[]): number | null {
  let hasValue = false
  const total = series.reduce((sum, key) => {
    const value = row[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) return sum
    hasValue = true
    return sum + value
  }, 0)
  return hasValue ? total : null
}

function getLatestSeriesValue(rows: TvlHistoryChartRow[], series: string): number {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const value = rows[index]?.[series]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return 0
}

export function buildTopSeriesChart(
  rows: TvlHistoryChartRow[],
  series: string[],
  remainingSeries: string,
  maxSeries = 10
): { rows: TvlHistoryChartRow[]; series: string[] } {
  const ranked = [...series].sort((a, b) => getLatestSeriesValue(rows, b) - getLatestSeriesValue(rows, a))
  const top = ranked.slice(0, maxSeries)
  const remaining = ranked.slice(maxSeries)

  return {
    rows: rows.map((row) => {
      const next: TvlHistoryChartRow = { timestamp: row.timestamp }
      for (const key of top) {
        const value = row[key]
        if (typeof value === 'number' && Number.isFinite(value)) next[key] = value
      }
      if (remaining.length > 0) {
        const values = remaining
          .map((key) => row[key])
          .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
        if (values.length > 0) next[remainingSeries] = values.reduce((sum, value) => sum + value, 0)
      }
      return next
    }),
    series: remaining.length > 0 ? [...top, remainingSeries] : top
  }
}

const VERSION_SERIES_LABELS: Record<string, string> = {
  v1: 'V1',
  v2: 'V2',
  v3: 'V3',
  curation: 'Curation'
}

export function labelVersionHistoryChart(
  rows: TvlHistoryChartRow[],
  series: string[]
): { rows: TvlHistoryChartRow[]; series: string[] } {
  return {
    rows: rows.map(
      (row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key === 'timestamp' ? key : (VERSION_SERIES_LABELS[key] ?? key),
            value
          ])
        ) as TvlHistoryChartRow
    ),
    series: series.map((key) => VERSION_SERIES_LABELS[key] ?? key)
  }
}

export function getStackRenderSeries(series: string[], remainingSeries: string): string[] {
  const ranked = series.filter((key) => key !== remainingSeries)
  return [...ranked.reverse(), ...(series.includes(remainingSeries) ? [remainingSeries] : [])]
}

export function addChartTotal(rows: TvlHistoryChartRow[], series: string[], totalSeries: string): TvlHistoryChartRow[] {
  return rows.map((row) => {
    const total = getAvailableRowTotal(row, series)
    return total === null ? { ...row } : { ...row, [totalSeries]: total }
  })
}

export function mergePriceNeutralTotal(
  actualRows: TvlHistoryChartRow[],
  priceNeutralRows: TvlHistoryChartRow[],
  priceNeutralSeries: string[]
): TvlHistoryChartRow[] {
  const rowsByTimestamp = new Map(actualRows.map((row) => [row.timestamp, { ...row }]))

  for (const row of priceNeutralRows) {
    const total = getAvailableRowTotal(row, priceNeutralSeries)
    if (total === null) continue
    const mergedRow = rowsByTimestamp.get(row.timestamp) ?? { timestamp: row.timestamp }
    mergedRow[PRICE_NEUTRAL_TOTAL_SERIES] = total
    rowsByTimestamp.set(row.timestamp, mergedRow)
  }

  return [...rowsByTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp)
}

export function isPriceNeutralOverlayVisible(view: 'line' | 'bar', requested: boolean): boolean {
  return view === 'line' && requested
}

export function getTvlHistoryErrorMessage({
  isConstantPrice,
  status,
  error
}: {
  isConstantPrice: boolean
  status: number | null
  error: string
}): string {
  if (isConstantPrice && status === 409) {
    return 'Price-neutral TVL is unavailable because the selected historical run must be backfilled with raw asset quantities.'
  }
  return `Error loading ${isConstantPrice ? 'price-neutral ' : ''}TVL history: ${error}`
}

export function getPriceNeutralCoverageLabel(
  meta: Partial<Pick<ConstantPriceTvlHistory['meta'], 'skippedVaults' | 'valuedVaults'>>
): string | null {
  if (meta.skippedVaults === undefined || meta.valuedVaults === undefined || meta.skippedVaults <= 0) return null
  return `Coverage excludes ${meta.skippedVaults.toLocaleString()} vault${
    meta.skippedVaults === 1 ? '' : 's'
  } without a usable reference price; ${meta.valuedVaults.toLocaleString()} valued.`
}
