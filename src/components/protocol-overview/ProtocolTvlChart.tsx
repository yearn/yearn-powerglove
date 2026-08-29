import React, { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FixedHeightChartContainer } from '@/components/charts/chart-container'
import { formatTvlDisplay } from '@/lib/formatters'
import {
  buildStackedTvlData,
  type ChainTvlSeries,
  getLatestTvlByChain,
  type ProtocolTvlTimeframe,
  type StackedTvlRow
} from '@/lib/protocol-tvl'
import { formatUnixTimestamp } from '@/lib/utils'

const TIMEFRAMES: Array<{ label: string; value: ProtocolTvlTimeframe }> = [
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
  { label: '1Y', value: '1y' },
  { label: 'All', value: 'all' }
]

const formatAxisUsd = (value: number): string => {
  if (!Number.isFinite(value)) return ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

const formatAxisTime = (value: number, timeframe: ProtocolTvlTimeframe): string => {
  const date = new Date(value * 1000)
  if (Number.isNaN(date.getTime())) return ''
  // Short windows show day-level; longer windows show month-level ticks.
  if (timeframe === '30d' || timeframe === '90d') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

interface TvlTooltipPayloadEntry {
  name?: string
  value?: number
  color?: string
  payload?: StackedTvlRow
}

interface TvlTooltipContentProps {
  active?: boolean
  payload?: TvlTooltipPayloadEntry[]
  label?: number | string
}

// Custom hover tooltip: each chain present at the hovered point (value > 0,
// largest first) plus a bold "Total" row sourced from the row's precomputed total.
function TvlTooltipContent({ active, payload, label }: TvlTooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null
  const rows = payload
    .filter((entry) => typeof entry.value === 'number' && entry.value > 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  const total = payload[0]?.payload?.total ?? rows.reduce((sum, r) => sum + (r.value ?? 0), 0)
  return (
    <div className="min-w-[160px] rounded-lg border border-gray-200 bg-white p-2 text-xs shadow-sm">
      <div className="mb-1 font-medium text-gray-700">{formatUnixTimestamp(Number(label))}</div>
      {rows.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5 text-gray-600">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.name}
          </span>
          <span className="font-medium text-gray-800">{formatTvlDisplay(Number(entry.value))}</span>
        </div>
      ))}
      <div className="mt-1 flex items-center justify-between gap-3 border-t border-gray-200 pt-1">
        <span className="font-semibold text-gray-700">Total</span>
        <span className="font-semibold text-gray-900">{formatTvlDisplay(total)}</span>
      </div>
    </div>
  )
}

interface ProtocolTvlChartProps {
  series: ChainTvlSeries[]
  /** When true, the historical source failed — show a status hint, not the chart. */
  tvlError?: boolean | null
}

function ProtocolTvlChartImpl({ series, tvlError }: ProtocolTvlChartProps) {
  const [timeframe, setTimeframe] = useState<ProtocolTvlTimeframe>('1y')

  // Derive the current per-chain breakdown from the latest point of each series
  // so the legend stays on the same footing as the historical area (DefiLlama),
  // and order the stack with the largest chains at the base.
  const latestByChain = useMemo(() => getLatestTvlByChain(series), [series])
  const orderedSeries = useMemo(() => {
    const order = new Map(latestByChain.map((c) => [c.chainId, c.tvl]))
    return [...series]
      .filter((s) => order.has(s.chainId))
      .sort((a, b) => (order.get(b.chainId) ?? 0) - (order.get(a.chainId) ?? 0))
  }, [series, latestByChain])

  const data = useMemo(() => buildStackedTvlData(series, timeframe, orderedSeries), [series, timeframe, orderedSeries])

  const grandTotal = latestByChain.reduce((sum, c) => sum + c.tvl, 0)
  // Tight y-axis ceiling: ~8% headroom over the visible max, snapped to a clean
  // $25M grid so the stacked area fills the panel without whitespace. Dynamic so
  // it scales correctly across timeframes (all-time highs dwarf today's TVL).
  const yAxisDomain = useMemo<[number, number] | undefined>(() => {
    if (data.length === 0) return undefined
    const maxTotal = data.reduce((max, row) => Math.max(max, row.total), 0)
    const ceiling = Math.round((maxTotal * 1.08) / 25_000_000) * 25_000_000
    return [0, Math.max(maxTotal, ceiling)]
  }, [data])

  return (
    <section className="border border-border bg-white">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <h2 className="text-sm font-semibold text-foreground">Protocol TVL by chain</h2>
        <div className="flex shrink-0 flex-wrap gap-2">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              type="button"
              onClick={() => setTimeframe(tf.value)}
              className={`rounded-md px-3 py-1.5 text-center text-xs font-medium transition-colors sm:text-sm ${
                timeframe === tf.value ? 'bg-[#0657f9] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-2 sm:px-6">
        <FixedHeightChartContainer heightClassName="h-[180px] sm:h-[220px] lg:h-[240px]">
          {data.length === 0 ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-xs text-gray-400">
              {tvlError ? 'Historical TVL unavailable' : 'Loading historical TVL…'}
            </div>
          ) : null}
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data as StackedTvlRow[]} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <defs>
                {orderedSeries.map((s) => (
                  <linearGradient key={s.chainId} id={`tvl-grad-${s.chainId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={s.color} stopOpacity={0.85} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0.55} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border, #e5e7eb)" strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tickFormatter={(v: number) => formatAxisTime(v, timeframe)}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
              />
              <YAxis
                domain={yAxisDomain}
                tickFormatter={formatAxisUsd}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip content={<TvlTooltipContent />} cursor={{ stroke: '#9ca3af', strokeDasharray: '3 3' }} />
              {orderedSeries.map((s) => (
                <Area
                  key={s.chainId}
                  type="monotone"
                  dataKey={s.name}
                  stackId="chains"
                  stroke={s.color}
                  strokeWidth={1}
                  fill={`url(#tvl-grad-${s.chainId})`}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </FixedHeightChartContainer>
      </div>

      {/* Legend: current TVL + share per chain (derived from the series' latest points) */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 pb-3 pt-1.5 sm:px-6">
        {latestByChain.map((c) => {
          const share = grandTotal > 0 ? (c.tvl / grandTotal) * 100 : 0
          return (
            <div key={c.chainId} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="text-xs font-medium text-foreground">{c.name}</span>
              <span className="text-xs text-gray-500">{formatTvlDisplay(c.tvl)}</span>
              <span className="text-[11px] text-gray-400">{share.toFixed(1)}%</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export const ProtocolTvlChart = React.memo(ProtocolTvlChartImpl)
