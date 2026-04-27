import { Activity, ExternalLink, Lock, Shuffle, TrendingUp } from 'lucide-react'
import React from 'react'
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHAIN_ID_TO_BLOCK_EXPLORER, type ChainId } from '@/constants/chains'
import { useVaultActivityData } from '@/hooks/useVaultActivityData'
import { formatPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { buildVaultActivityChartSeries, isHarvestLikeEvent } from '@/lib/vault-activity'
import type { VaultActivityEvent, VaultActivitySeriesPoint, VaultUnlockState } from '@/types/vaultActivityTypes'
import type { VaultDerivedStrategy, VaultExtended } from '@/types/vaultTypes'

interface VaultActivitySummaryProps {
  vaultChainId: ChainId
  vaultDetails: VaultExtended
}

interface ActivityMetric {
  label: string
  value: string
  detail?: string
}

const eventIconByType = {
  harvest: TrendingUp,
  strategy_reported: TrendingUp,
  unlock_update: Lock,
  debt_update: Shuffle
} satisfies Record<VaultActivityEvent['eventType'], React.ComponentType<{ className?: string }>>

const loadingMetricKeys = ['unlocked', 'rate', 'full-unlock', 'last-update']

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

function formatUtcDateTime(value?: string | null): string {
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
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC'
  }).format(date)
}

function formatUtcTimestamp(value?: string | number | null): string {
  if (value === null || value === undefined) {
    return 'No data'
  }

  const timestamp = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(timestamp)) {
    return 'No data'
  }

  return formatUtcDateTime(new Date(timestamp * 1000).toISOString())
}

function formatDateRange(startIso?: string | null, endIso?: string | null): string | null {
  if (!startIso || !endIso) {
    return null
  }

  const start = formatUtcDate(startIso)
  const end = formatUtcDate(endIso)
  if (start === 'No data' || end === 'No data') {
    return null
  }

  return start === end ? start : `${start} - ${end}`
}

function formatNumber(value?: number | null, maximumFractionDigits = 4): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'No data'
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits
  }).format(value)
}

function formatSignedAmount(value?: number | null, symbol?: string | null): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null
  }

  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: Math.abs(value) >= 1 ? 2 : 6
  }).format(value)
  return `${value > 0 ? '+' : ''}${formatted}${symbol ? ` ${symbol}` : ''}`
}

function formatBasisPoints(value?: string | null): string | null {
  if (!value) {
    return null
  }

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return null
  }

  return formatPercent(numeric / 100, { decimals: 2, fallback: 'No data' })
}

function getExplorerBaseUrl(chainId: number): string | null {
  return CHAIN_ID_TO_BLOCK_EXPLORER[chainId as ChainId]?.replace(/\/+$/, '') ?? null
}

function getStrategyNamesByAddress(strategyDetails: VaultDerivedStrategy[] | undefined): Record<string, string> {
  const namesByAddress: Record<string, string> = {}

  for (const strategy of strategyDetails ?? []) {
    const address = strategy.address?.toLowerCase()
    const name = strategy.name?.trim()
    if (address && name) {
      namesByAddress[address] = name
    }
  }

  return namesByAddress
}

function getEventStrategyLabel(event: VaultActivityEvent, namesByAddress: Record<string, string>): string | null {
  if (event.strategyName) {
    return event.strategyName
  }

  if (!event.strategyAddress) {
    return null
  }

  return (
    namesByAddress[event.strategyAddress.toLowerCase()] ??
    `${event.strategyAddress.slice(0, 6)}...${event.strategyAddress.slice(-4)}`
  )
}

function getEventAmountLabel(event: VaultActivityEvent, assetSymbol?: string | null): string | null {
  if (event.eventType === 'strategy_reported' || event.eventType === 'harvest') {
    const gain = formatSignedAmount(event.gainDisplay, assetSymbol)
    if (gain) {
      return gain
    }
  }

  if (event.eventType === 'debt_update') {
    return formatSignedAmount(event.debtDeltaDisplay, assetSymbol) ?? formatBasisPoints(event.debtRatio)
  }

  if (event.eventType === 'unlock_update') {
    return event.unlockPercent !== null && event.unlockPercent !== undefined
      ? formatPercent(event.unlockPercent, { decimals: 2, fallback: 'No data' })
      : null
  }

  return null
}

function getActivityCoverage(events: VaultActivityEvent[]) {
  if (events.length === 0) {
    return null
  }

  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp)
  const firstEvent = sortedEvents[0]
  const lastEvent = sortedEvents[sortedEvents.length - 1]

  return {
    dateRange: formatDateRange(firstEvent.timestampIso, lastEvent.timestampIso),
    blockRange: `${firstEvent.blockNumber.toLocaleString()} - ${lastEvent.blockNumber.toLocaleString()}`,
    harvestCount: events.filter(isHarvestLikeEvent).length
  }
}

function ChartTooltipContent({
  active,
  payload,
  label,
  unlockLabel
}: {
  active?: boolean
  payload?: Array<{ dataKey?: string | number; value?: unknown; payload?: VaultActivitySeriesPoint }>
  label?: string | number
  unlockLabel: string
}) {
  if (!active || !payload?.length) {
    return null
  }

  const point = payload[0]?.payload
  if (!point) {
    return null
  }

  return (
    <div className="min-w-[10rem] border border-border bg-white px-3 py-2 text-xs shadow-lg">
      <div className="mb-2 font-medium text-[#111111]">{formatUtcTimestamp(label)}</div>
      <div className="space-y-1 text-[#666666]">
        <div className="flex justify-between gap-4">
          <span>Harvests</span>
          <span className="tabular-nums text-[#111111]">{point.harvestCount}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>{unlockLabel}</span>
          <span className="tabular-nums text-[#111111]">
            {formatPercent(point.unlockPercent, { decimals: 2, fallback: 'No data' })}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Rate/day</span>
          <span className="tabular-nums text-[#111111]">
            {formatPercent(point.unlockRatePerDay, { decimals: 4, fallback: 'No data' })}
          </span>
        </div>
      </div>
    </div>
  )
}

function ActivityChart({
  series,
  events,
  currentUnlock,
  unlockLabel
}: {
  series: VaultActivitySeriesPoint[]
  events: VaultActivityEvent[]
  currentUnlock: VaultUnlockState | null
  unlockLabel: string
}) {
  const chartSeries = React.useMemo(
    () => buildVaultActivityChartSeries({ events, series, currentUnlock }),
    [events, series, currentUnlock]
  )

  if (chartSeries.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center border border-dashed border-border text-sm text-muted-foreground">
        No chart points available.
      </div>
    )
  }

  const hasUnlockData = chartSeries.some(
    (point) =>
      (point.unlockPercent !== null && point.unlockPercent !== undefined) ||
      (point.unlockRatePerDay !== null && point.unlockRatePerDay !== undefined)
  )
  const harvestEvents = events.filter(isHarvestLikeEvent)
  const chartTimestamps = [
    ...chartSeries.map((point) => point.timestamp),
    ...harvestEvents.map((event) => event.timestamp)
  ]
  const chartStart = Math.min(...chartTimestamps)
  const chartEnd = Math.max(...chartTimestamps)
  const chartPadding = chartStart === chartEnd ? 43_200 : 0

  return (
    <div className="h-[260px] w-full md:h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartSeries} margin={{ top: 12, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#e5e7eb" />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={[chartStart - chartPadding, chartEnd + chartPadding]}
            minTickGap={28}
            tick={{ fontSize: 11, fill: '#666666' }}
            tickFormatter={(value) => {
              const timestamp = Number(value)
              return Number.isFinite(timestamp) ? formatUtcDate(new Date(timestamp * 1000).toISOString()) : ''
            }}
            tickLine={false}
          />
          <YAxis
            yAxisId="unlock"
            width={48}
            domain={hasUnlockData ? [0, 'auto'] : [0, 1]}
            tickFormatter={(value) => `${value}%`}
            tick={hasUnlockData ? { fontSize: 11, fill: '#666666' } : false}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<ChartTooltipContent unlockLabel={unlockLabel} />} />
          {harvestEvents.map((event) => (
            <ReferenceLine
              key={`harvest-${event.id}`}
              yAxisId="unlock"
              x={event.timestamp}
              stroke="#0657f9"
              strokeWidth={1.5}
              strokeOpacity={0.9}
              ifOverflow="extendDomain"
            />
          ))}
          <Line
            yAxisId="unlock"
            type="linear"
            dataKey="unlockPercent"
            stroke="#111111"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="unlock"
            type="linear"
            dataKey="unlockRatePerDay"
            stroke="#8b8b8b"
            strokeDasharray="6 4"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function ActivityFeed({
  events,
  chainId,
  assetSymbol,
  namesByAddress
}: {
  events: VaultActivityEvent[]
  chainId: number
  assetSymbol?: string | null
  namesByAddress: Record<string, string>
}) {
  const explorerBaseUrl = getExplorerBaseUrl(chainId)
  const recentEvents = React.useMemo(
    () =>
      [...events]
        .sort((a, b) => {
          if (a.timestamp !== b.timestamp) {
            return b.timestamp - a.timestamp
          }
          if (a.blockNumber !== b.blockNumber) {
            return b.blockNumber - a.blockNumber
          }
          return (b.logIndex ?? 0) - (a.logIndex ?? 0)
        })
        .slice(0, 6),
    [events]
  )

  if (recentEvents.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">No normalized activity rows found in this fixture.</p>
  }

  return (
    <div className="divide-y divide-border">
      {recentEvents.map((event) => {
        const Icon = eventIconByType[event.eventType]
        const strategyLabel = getEventStrategyLabel(event, namesByAddress)
        const amountLabel = getEventAmountLabel(event, assetSymbol)
        const txUrl = explorerBaseUrl ? `${explorerBaseUrl}/tx/${event.txHash}` : null
        const blockUrl = explorerBaseUrl ? `${explorerBaseUrl}/block/${event.blockNumber}` : null

        return (
          <div key={event.id} className="grid gap-3 py-3 text-sm md:grid-cols-[1fr_auto] md:items-center">
            <div className="flex min-w-0 gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border border-border bg-gray-50 text-[#333333]">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="font-medium text-[#111111]">{event.label}</p>
                  {amountLabel ? <span className="font-mono text-xs text-[#0657f9]">{amountLabel}</span> : null}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{event.description}</p>
                {strategyLabel ? <p className="mt-1 truncate text-xs text-[#666666]">{strategyLabel}</p> : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground md:justify-end">
              <span>{formatUtcDateTime(event.timestampIso)}</span>
              {blockUrl ? (
                <a
                  className="inline-flex items-center gap-1 hover:text-[#0657f9]"
                  href={blockUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  #{event.blockNumber}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span>#{event.blockNumber}</span>
              )}
              {txUrl ? (
                <a
                  className="inline-flex items-center gap-1 hover:text-[#0657f9]"
                  href={txUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Tx
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export const VaultActivitySummary: React.FC<VaultActivitySummaryProps> = React.memo(
  ({ vaultChainId, vaultDetails }) => {
    const { data, isLoading, error } = useVaultActivityData(vaultDetails.address, vaultChainId)
    const namesByAddress = React.useMemo(
      () => getStrategyNamesByAddress(vaultDetails.strategyDetails),
      [vaultDetails.strategyDetails]
    )
    const assetSymbol = vaultDetails.asset?.symbol
    const coverage = React.useMemo(() => getActivityCoverage(data?.events ?? []), [data?.events])
    const metrics = React.useMemo<ActivityMetric[]>(() => {
      const unlock = data?.currentUnlock
      const isV2Unlock = unlock?.profitUnlockMode === 'v2_locked_profit'
      const hasUnlockSchedule = Boolean(
        unlock &&
          (isV2Unlock
            ? (unlock.lockedProfit !== null && unlock.lockedProfit !== undefined) ||
              unlock.lockedProfitDegradation ||
              unlock.lastReport ||
              (unlock.lockedProfitPercent !== null && unlock.lockedProfitPercent !== undefined)
            : unlock.unlockedShares ||
              unlock.profitUnlockingRate ||
              unlock.profitMaxUnlockTime ||
              unlock.fullProfitUnlockDate ||
              (unlock.unlockPercent !== null && unlock.unlockPercent !== undefined))
      )

      return [
        {
          label: isV2Unlock ? 'Locked Profit' : 'Unlocked',
          value: hasUnlockSchedule
            ? formatPercent(isV2Unlock ? unlock?.lockedProfitPercent : unlock?.unlockPercent, {
                decimals: 2,
                fallback: 'No data'
              })
            : 'N/A',
          detail: !hasUnlockSchedule
            ? 'No profit unlock schedule'
            : isV2Unlock
              ? unlock?.lockedProfitDisplay !== null && unlock?.lockedProfitDisplay !== undefined
                ? `${formatNumber(unlock.lockedProfitDisplay, 4)} ${assetSymbol ?? 'assets'}`
                : 'V2 profit lock'
              : unlock?.unlockedSharesDisplay !== null && unlock?.unlockedSharesDisplay !== undefined
                ? `${formatNumber(unlock.unlockedSharesDisplay, 4)} shares`
                : undefined
        },
        {
          label: 'Unlock Rate',
          value: hasUnlockSchedule
            ? formatPercent(unlock?.unlockRatePerDay, { decimals: 4, fallback: 'No data' })
            : 'N/A',
          detail: hasUnlockSchedule ? (isV2Unlock ? 'locked profit per day' : 'per day') : 'No unlock state'
        },
        {
          label: 'Full Unlock',
          value: hasUnlockSchedule ? formatUtcDate(unlock?.fullProfitUnlockDateIso) : 'N/A',
          detail: !hasUnlockSchedule
            ? 'Not exposed on vault'
            : unlock?.estimatedDaysToUnlock !== null && unlock?.estimatedDaysToUnlock !== undefined
              ? `${formatNumber(unlock.estimatedDaysToUnlock, 1)} days`
              : undefined
        },
        {
          label: 'Last Update',
          value: formatUtcDateTime(unlock?.updatedAtIso),
          detail: unlock?.blockNumber ? `Block ${unlock.blockNumber}` : undefined
        }
      ]
    }, [assetSymbol, data?.currentUnlock])
    const unlockLineLabel =
      data?.currentUnlock?.profitUnlockMode === 'v2_locked_profit' ? 'Locked profit %' : 'Unlock %'

    return (
      <section className="border-b border-border bg-white">
        <div className="border-b border-border p-4 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#111111]">Harvest and Unlock Activity</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Fixture-backed harvests, unlock state, and debt movement.
              </p>
              {coverage?.dateRange ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Coverage: {coverage.dateRange} · blocks {coverage.blockRange} · {coverage.harvestCount} harvest
                  markers
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              <span>{data ? `${data.events.length} rows` : 'POC fixture'}</span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-3 p-4 sm:grid-cols-4 sm:p-6">
            {loadingMetricKeys.map((key) => (
              <div key={key} className="h-20 animate-pulse border border-border bg-gray-50" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4 sm:p-6">
            <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Harvest/unlock activity could not be parsed: {error.message}
            </div>
          </div>
        ) : !data ? (
          <div className="p-4 sm:p-6">
            <div className="border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
              No harvest/unlock activity fixture found for this vault.
            </div>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-2 border-b border-border sm:grid-cols-4">
              {metrics.map((metric, index) => (
                <div
                  key={metric.label}
                  className={cn('border-border p-4 sm:border-b-0 sm:border-r sm:last:border-r-0', {
                    'border-r': index % 2 === 0,
                    'border-b': index < 2,
                    'sm:border-l-0': index === 0
                  })}
                >
                  <p className="text-xs uppercase text-muted-foreground">{metric.label}</p>
                  <p className="mt-2 text-lg font-semibold text-[#111111]">{metric.value}</p>
                  {metric.detail ? <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p> : null}
                </div>
              ))}
            </div>

            <div className="grid gap-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.9fr)]">
              <div className="border-b border-border p-4 sm:p-6 lg:border-r lg:border-b-0">
                <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-5 w-0 border-l-2 border-[#0657f9]" />
                    Harvest events
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-0.5 w-5 bg-[#111111]" />
                    {unlockLineLabel}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-0.5 w-5 border-t border-dashed border-[#8b8b8b]" />
                    Rate/day
                  </span>
                </div>
                <ActivityChart
                  series={data.series}
                  events={data.events}
                  currentUnlock={data.currentUnlock}
                  unlockLabel={unlockLineLabel}
                />
              </div>
              <div className="p-4 sm:p-6">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-[#111111]">Recent Activity</h3>
                  <span className="text-xs text-muted-foreground">{formatUtcDateTime(data.generatedAt)}</span>
                </div>
                <ActivityFeed
                  events={data.events}
                  chainId={vaultChainId}
                  assetSymbol={assetSymbol}
                  namesByAddress={namesByAddress}
                />
              </div>
            </div>
          </div>
        )}
      </section>
    )
  }
)

VaultActivitySummary.displayName = 'VaultActivitySummary'
