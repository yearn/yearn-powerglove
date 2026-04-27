import React, { useMemo } from 'react'
import { CartesianGrid, ComposedChart, Line, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartContainer } from '@/components/ui/chart'
import { useIsMobile } from '@/components/ui/use-mobile'
import { buildVaultLockedSharesChartSeries, isHarvestLikeEvent } from '@/lib/vault-activity'
import type { VaultActivityData, VaultActivityEvent, VaultActivitySeriesPoint } from '@/types/vaultActivityTypes'

interface VaultLockedSharesChartProps {
  activityData: VaultActivityData | null
  timeframe: string
  isLoading?: boolean
  error?: Error | null
}

const DAY_SECONDS = 86_400
const TIMEFRAME_DAYS: Record<string, number> = {
  '30d': 30,
  '90d': 90,
  '1y': 365
}

function formatUtcDate(value?: string | null): string {
  if (!value) {
    return 'No data'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'No data'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date)
}

function formatUtcTimestamp(value?: string | number | null): string {
  if (value === null || value === undefined) {
    return 'No data'
  }

  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) {
    return 'No data'
  }

  return formatUtcDate(new Date(timestamp * 1000).toISOString())
}

function formatShareAmount(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'No data'
  }

  const useCompactNotation = Math.abs(value) >= 10_000
  return new Intl.NumberFormat('en-US', {
    notation: useCompactNotation ? 'compact' : 'standard',
    maximumFractionDigits: useCompactNotation ? 2 : 6
  }).format(value)
}

function dateFromTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10)
}

function interpolateNullableNumber(start: number | null | undefined, end: number | null | undefined, ratio: number) {
  if (typeof start === 'number' && typeof end === 'number') {
    return start + (end - start) * ratio
  }

  return start ?? end ?? null
}

function getTimeframeStartTimestamp(
  data: VaultActivityData,
  chartSeries: VaultActivitySeriesPoint[],
  timeframe: string
): number | null {
  if (timeframe === 'all') {
    return null
  }

  const days = TIMEFRAME_DAYS[timeframe]
  if (!days) {
    return null
  }

  const latestTimestamp = Math.max(
    data.currentUnlock?.updatedAt ?? 0,
    ...chartSeries.map((point) => point.timestamp),
    ...data.events.map((event) => event.timestamp)
  )

  return latestTimestamp - days * DAY_SECONDS
}

function buildTimeframeBoundaryPoint(
  previousPoint: VaultActivitySeriesPoint,
  nextPoint: VaultActivitySeriesPoint,
  timestamp: number
): VaultActivitySeriesPoint | null {
  const duration = nextPoint.timestamp - previousPoint.timestamp
  if (duration <= 0) {
    return null
  }

  const ratio = (timestamp - previousPoint.timestamp) / duration
  return {
    date: dateFromTimestamp(timestamp),
    timestamp,
    harvestCount: 0,
    harvestValueUsd: null,
    harvestGainDisplay: null,
    remainingLockedSharesDisplay: interpolateNullableNumber(
      previousPoint.remainingLockedSharesDisplay,
      nextPoint.remainingLockedSharesDisplay,
      ratio
    ),
    lockedProfitPercent: interpolateNullableNumber(
      previousPoint.lockedProfitPercent,
      nextPoint.lockedProfitPercent,
      ratio
    ),
    unlockPercent: interpolateNullableNumber(previousPoint.unlockPercent, nextPoint.unlockPercent, ratio),
    unlockRatePerDay: interpolateNullableNumber(previousPoint.unlockRatePerDay, nextPoint.unlockRatePerDay, ratio),
    pps: interpolateNullableNumber(previousPoint.pps, nextPoint.pps, ratio),
    totalAssetsDisplay: interpolateNullableNumber(previousPoint.totalAssetsDisplay, nextPoint.totalAssetsDisplay, ratio)
  }
}

function filterSeriesByStartTimestamp(
  series: VaultActivitySeriesPoint[],
  startTimestamp: number | null
): VaultActivitySeriesPoint[] {
  if (startTimestamp === null) {
    return series
  }

  const sortedSeries = [...series].sort((a, b) => a.timestamp - b.timestamp)
  const visibleSeries = sortedSeries.filter((point) => point.timestamp >= startTimestamp)
  if (visibleSeries.length === 0 || visibleSeries[0].timestamp === startTimestamp) {
    return visibleSeries
  }

  let previousPoint: VaultActivitySeriesPoint | null = null
  for (let index = sortedSeries.length - 1; index >= 0; index -= 1) {
    const point = sortedSeries[index]
    if (point.timestamp < startTimestamp) {
      previousPoint = point
      break
    }
  }

  if (!previousPoint) {
    return visibleSeries
  }

  const boundaryPoint = buildTimeframeBoundaryPoint(previousPoint, visibleSeries[0], startTimestamp)
  return boundaryPoint ? [boundaryPoint, ...visibleSeries] : visibleSeries
}

function filterLockedSharesSeries(
  data: VaultActivityData,
  timeframe: string
): {
  series: VaultActivitySeriesPoint[]
  harvestEvents: VaultActivityEvent[]
} {
  const chartSeries = buildVaultLockedSharesChartSeries(data)
  const startTimestamp = getTimeframeStartTimestamp(data, chartSeries, timeframe)
  const isInTimeframe = (timestamp: number) => startTimestamp === null || timestamp >= startTimestamp

  return {
    series: filterSeriesByStartTimestamp(chartSeries, startTimestamp),
    harvestEvents: data.events.filter((event) => isHarvestLikeEvent(event) && isInTimeframe(event.timestamp))
  }
}

function LockedSharesTooltip({
  active,
  payload,
  label
}: {
  active?: boolean
  payload?: Array<{ dataKey?: string | number; value?: unknown; payload?: VaultActivitySeriesPoint }>
  label?: string | number
}) {
  if (!active || !payload?.length) {
    return null
  }

  const point = payload[0]?.payload
  if (!point) {
    return null
  }

  return (
    <div className="grid min-w-[9rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{formatUtcTimestamp(label)}</div>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <span>Harvests</span>
          <span className="tabular-nums">{point.harvestCount}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Locked shares</span>
          <span className="tabular-nums">{formatShareAmount(point.remainingLockedSharesDisplay)}</span>
        </div>
      </div>
    </div>
  )
}

export const VaultLockedSharesChart: React.FC<VaultLockedSharesChartProps> = React.memo(
  ({ activityData, timeframe, isLoading, error }) => {
    const isMobile = useIsMobile()
    const filteredActivity = useMemo(
      () => (activityData ? filterLockedSharesSeries(activityData, timeframe) : { series: [], harvestEvents: [] }),
      [activityData, timeframe]
    )
    const chartTimestamps = [
      ...filteredActivity.series.map((point) => point.timestamp),
      ...filteredActivity.harvestEvents.map((event) => event.timestamp)
    ]
    const chartStart = chartTimestamps.length > 0 ? Math.min(...chartTimestamps) : 0
    const chartEnd = chartTimestamps.length > 0 ? Math.max(...chartTimestamps) : 0
    const chartPadding = chartStart === chartEnd ? DAY_SECONDS / 2 : 0
    const hasLockedSharesData = filteredActivity.series.some(
      (point) => point.remainingLockedSharesDisplay !== null && point.remainingLockedSharesDisplay !== undefined
    )

    if (isLoading) {
      return (
        <div className="flex h-full items-center justify-center border border-dashed border-border text-sm text-muted-foreground">
          Loading harvest activity...
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex h-full items-center justify-center border border-amber-200 bg-amber-50 px-4 text-center text-sm text-amber-800">
          Harvest activity could not be parsed.
        </div>
      )
    }

    if (!activityData) {
      return (
        <div className="flex h-full items-center justify-center border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
          No harvest/unlock activity fixture found for this vault.
        </div>
      )
    }

    if (filteredActivity.series.length === 0) {
      return (
        <div className="flex h-full items-center justify-center border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
          No locked share activity in this timeframe.
        </div>
      )
    }

    return (
      <div className="relative h-full">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="h-5 w-0 border-l-2 border-[#0657f9]" />
            Harvest events
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-5 bg-[#111111]" />
            Locked shares
          </span>
        </div>
        <ChartContainer
          config={{
            remainingLockedSharesDisplay: { label: 'Locked shares', color: '#111111' }
          }}
          style={{ height: '100%' }}
        >
          <ComposedChart
            data={filteredActivity.series}
            margin={{
              top: isMobile ? 52 : 42,
              right: isMobile ? 8 : 20,
              left: isMobile ? -18 : 0,
              bottom: isMobile ? 12 : 16
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={[chartStart - chartPadding, chartEnd + chartPadding]}
              minTickGap={isMobile ? 32 : 24}
              tick={{
                fill: 'hsl(var(--muted-foreground))',
                fontSize: isMobile ? 11 : 12
              }}
              tickFormatter={(value) => formatUtcTimestamp(value)}
              axisLine={{ stroke: 'hsl(var(--muted-foreground))' }}
              tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              width={isMobile ? 52 : 68}
              domain={hasLockedSharesData ? [0, 'auto'] : [0, 1]}
              tickFormatter={(value) => formatShareAmount(Number(value))}
              label={
                isMobile
                  ? undefined
                  : {
                      value: 'Locked shares',
                      angle: -90,
                      position: 'insideLeft',
                      offset: 10,
                      style: {
                        textAnchor: 'middle',
                        fill: 'hsl(var(--muted-foreground))'
                      }
                    }
              }
              tick={{
                fill: 'hsl(var(--muted-foreground))',
                fontSize: isMobile ? 11 : 12
              }}
              axisLine={{ stroke: 'hsl(var(--muted-foreground))' }}
              tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip content={<LockedSharesTooltip />} />
            {filteredActivity.harvestEvents.map((event) => (
              <ReferenceLine
                key={`harvest-${event.id}`}
                x={event.timestamp}
                stroke="#0657f9"
                strokeWidth={1.5}
                strokeOpacity={0.65}
                ifOverflow="extendDomain"
              />
            ))}
            <Line
              type="linear"
              dataKey="remainingLockedSharesDisplay"
              stroke="var(--color-remainingLockedSharesDisplay)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ChartContainer>
      </div>
    )
  }
)

VaultLockedSharesChart.displayName = 'VaultLockedSharesChart'

export default VaultLockedSharesChart
