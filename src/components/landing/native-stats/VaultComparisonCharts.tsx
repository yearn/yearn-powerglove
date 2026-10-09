import { useQueries, useQuery } from '@tanstack/react-query'
import { ChevronDown, X } from 'lucide-react'
import { useId, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { ChainFeeHistoryView } from './ChainFeeHistoryCharts'
import type { StatsChartType } from './ChartTypeToggle'
import type { CanonicalFeeHistory, CanonicalVaultFee, FeeHistoryInterval } from './canonical-fees'
import { FeeBreakdownChart } from './FeeBreakdownChart'
import type { FeeHistoryPeriod } from './fee-history'
import { CHAIN_NAMES, CHAIN_SHORT, resolveStatsApiBase, SkeletonChart } from './hooks'
import {
  allocatorKey,
  allocatorMovingAverageWindow,
  buildVaultFeeHistorySeries,
  fourWeekVaultMovingAverage,
  rankAllocators
} from './vault-fee-history'

const COLORS = ['#0657f9', '#16a34a', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#64748b']
const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`
const vaultLabel = (vault: CanonicalVaultFee) =>
  `${vault.name ?? 'Unnamed vault'} · ${CHAIN_SHORT[vault.chainId] ?? vault.chainId} · ${shortAddress(vault.address)}`

export async function fetchAllocatorHistory(
  base: string,
  query: string,
  vault: CanonicalVaultFee,
  signal: AbortSignal
) {
  const params = new URLSearchParams(query)
  params.set('chainId', String(vault.chainId))
  params.set('vaultAddress', vault.address)
  const response = await fetch(`${base}/api/fees/history?${params}`, { signal })
  if (!response.ok) throw new Error('Vault history could not be loaded')
  const history: CanonicalFeeHistory = await response.json()
  if (
    !Array.isArray(history.buckets) ||
    history.datasetId !== params.get('datasetId') ||
    history.interval !== params.get('interval')
  )
    throw new Error('Vault history does not match the selected publication')
  return history
}

export function VaultComparisonCharts({
  query,
  rankedVaults,
  periods,
  view,
  interval,
  renderType,
  selectedKeys,
  onSelectedKeysChange
}: {
  query: string
  rankedVaults: CanonicalVaultFee[]
  periods: FeeHistoryPeriod[]
  view: ChainFeeHistoryView
  interval: FeeHistoryInterval
  renderType: StatsChartType
  selectedKeys: string[] | null
  onSelectedKeysChange: (keys: string[]) => void
}) {
  const base = resolveStatsApiBase('fees') ?? ''
  const params = new URLSearchParams(query)
  const datasetId = params.get('datasetId')
  const chainId = params.get('chainId')
  const pickerId = useId()
  const [search, setSearch] = useState('')
  const catalog = useQuery({
    queryKey: ['allocator-comparison-catalog', base, datasetId],
    enabled: !!datasetId,
    staleTime: Infinity,
    retry: false,
    queryFn: async ({ signal }): Promise<CanonicalVaultFee[]> => {
      const response = await fetch(`${base}/api/fees/vaults?${new URLSearchParams({ datasetId: datasetId ?? '' })}`, {
        signal
      })
      if (!response.ok) throw new Error('Allocator catalog could not be loaded')
      const payload: { vaults: CanonicalVaultFee[]; datasetId: string } = await response.json()
      if (!Array.isArray(payload.vaults) || payload.datasetId !== datasetId)
        throw new Error('Allocator catalog does not match the selected publication')
      return rankAllocators(payload.vaults, 'fees')
    }
  })
  const allocators = (catalog.data ?? rankAllocators(rankedVaults, 'fees')).filter(
    (vault) => !chainId || String(vault.chainId) === chainId
  )
  const keys = selectedKeys ?? rankAllocators(rankedVaults, 'fees').slice(0, 5).map(allocatorKey)
  const selected = keys.flatMap((key) => {
    const vault = allocators.find((vault) => allocatorKey(vault) === key)
    return vault ? [vault] : []
  })
  const smoothed = renderType === 'line' && view === 'periodic'
  const weeklyWindow = allocatorMovingAverageWindow(query, Math.floor(Date.now() / 1000))
  const historyQuery = smoothed ? weeklyWindow.query : query
  const historyPeriods = smoothed ? weeklyWindow.periods : periods
  const histories = useQueries({
    queries: selected.map((vault) => ({
      queryKey: ['allocator-comparison-history', base, historyQuery, allocatorKey(vault)],
      enabled: !!datasetId && historyPeriods.length > 0,
      staleTime: Infinity,
      retry: false,
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchAllocatorHistory(base, historyQuery, vault, signal)
    }))
  })
  const series = selected.map((vault, index) => ({
    key: allocatorKey(vault),
    label: vaultLabel(vault),
    color: COLORS[index % COLORS.length]
  }))
  const data = buildVaultFeeHistorySeries(
    selected.map((vault, index) => ({ key: allocatorKey(vault), history: histories[index].data })),
    historyPeriods
  )
  const chartData = smoothed
    ? fourWeekVaultMovingAverage(data.periodic).filter(
        (point) => Date.parse(`${point.period}T00:00:00Z`) / 1000 >= weeklyWindow.first
      )
    : data[view]
  const failed = histories.flatMap((history, index) => (history.isError ? [vaultLabel(selected[index])] : []))
  const loading = historyPeriods.length > 0 && histories.some((history) => history.isPending)
  const results = allocators.filter((vault) =>
    `${vault.name ?? ''} ${vault.address} ${CHAIN_NAMES[vault.chainId] ?? vault.chainId}`
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  )
  const toggle = (key: string) =>
    onSelectedKeysChange(keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key])

  return (
    <section className="chain-fee-charts" aria-label="V3 allocator vault comparison" aria-busy={loading}>
      <div className="card fee-chart-card">
        <div className="fee-chart-header">
          <h2>Compare V3 Allocators</h2>
          <div className="allocator-comparison-actions">
            <Popover
              onOpenChange={(open) => {
                if (!open) setSearch('')
              }}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="page-btn allocator-picker-trigger"
                  aria-controls={pickerId}
                  disabled={catalog.isPending}
                >
                  Choose vaults ({selected.length}) <ChevronDown size={14} aria-hidden="true" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                id={pickerId}
                align="start"
                className="w-[min(28rem,calc(100vw-2rem))] rounded-none p-3"
                aria-label="Choose V3 allocator vaults"
              >
                <input
                  aria-label="Search V3 allocator vaults"
                  placeholder="Search name, address, or chain…"
                  className="mb-3 h-10 w-full border border-input bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <fieldset className="max-h-72 overflow-y-auto">
                  <legend className="sr-only">V3 allocator vaults</legend>
                  {results.map((vault) => (
                    <label
                      key={allocatorKey(vault)}
                      className="flex cursor-pointer items-center gap-3 border-b px-2 py-3 text-sm hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={keys.includes(allocatorKey(vault))}
                        onChange={() => toggle(allocatorKey(vault))}
                        aria-label={vaultLabel(vault)}
                        className="shrink-0 accent-primary"
                      />
                      <span className="min-w-0 break-words">
                        <span className="block">{vault.name ?? 'Unnamed vault'}</span>
                        <span className="text-xs text-muted-foreground">
                          {CHAIN_NAMES[vault.chainId] ?? vault.chainId} · {shortAddress(vault.address)}
                        </span>
                      </span>
                    </label>
                  ))}
                  {!results.length && (
                    <p className="py-3 text-sm text-muted-foreground">No matching V3 allocator vaults.</p>
                  )}
                </fieldset>
              </PopoverContent>
            </Popover>
            <button
              type="button"
              className="page-btn"
              disabled={!rankedVaults.length}
              onClick={() => onSelectedKeysChange(rankAllocators(rankedVaults, 'fees').slice(0, 5).map(allocatorKey))}
            >
              Top 5 by fees
            </button>
            <button
              type="button"
              className="page-btn"
              disabled={!rankedVaults.length}
              onClick={() =>
                onSelectedKeysChange(rankAllocators(rankedVaults, 'earnings').slice(0, 5).map(allocatorKey))
              }
            >
              Top 5 by earnings
            </button>
            <button type="button" className="page-btn" disabled={!keys.length} onClick={() => onSelectedKeysChange([])}>
              Clear selection
            </button>
          </div>
        </div>
        <p className="text-dim">
          Choose allocators to compare over the selected timeframe. Top-five selections use earnings or fees in that
          range.
        </p>
        <div className="allocator-comparison-selection" aria-label="Selected allocator vaults">
          {selected.map((vault, index) => (
            <button
              type="button"
              key={allocatorKey(vault)}
              className="page-btn allocator-selected-vault"
              aria-label={`Remove ${vaultLabel(vault)}`}
              onClick={() => toggle(allocatorKey(vault))}
            >
              <span
                className="fee-series-swatch"
                aria-hidden="true"
                style={{ backgroundColor: series[index].color, borderColor: series[index].color }}
              />
              <span>{vaultLabel(vault)}</span>
              <X size={13} aria-hidden="true" />
            </button>
          ))}
        </div>
        {catalog.isError && (
          <div className="error-retry">
            <p>The vault picker could not be loaded.</p>
            <button type="button" className="page-btn" onClick={() => void catalog.refetch()}>
              Retry vault picker
            </button>
          </div>
        )}
        {failed.length > 0 && (
          <div className="error-retry">
            <p>History could not be loaded for {failed.join(', ')}.</p>
            <button
              type="button"
              className="page-btn"
              onClick={() => {
                for (const history of histories) if (history.isError) void history.refetch()
              }}
            >
              Retry vault history
            </button>
          </div>
        )}
        {loading && <output className="text-dim">Loading selected vault histories…</output>}
        {!selected.length && !catalog.isPending && (
          <p className="text-dim">Choose V3 allocator vaults to build your comparison.</p>
        )}
      </div>
      {selected.length > 0 &&
        (loading && histories.every((history) => !history.data) ? (
          <SkeletonChart />
        ) : (
          <>
            <FeeBreakdownChart
              stacked={false}
              title="Earnings by Allocator Vault"
              subtitle={
                smoothed
                  ? '4-week moving average · Average weekly net earnings (USD)'
                  : 'Reported gross gains less losses'
              }
              metric="earnings"
              data={chartData}
              series={series}
              interval={smoothed ? 'weekly' : interval}
              renderType={renderType}
            />
            <FeeBreakdownChart
              stacked={false}
              title="Fees by Allocator Vault"
              subtitle={smoothed ? '4-week moving average · Average weekly fees (USD)' : 'Gross fees charged'}
              metric="fees"
              data={chartData}
              series={series}
              interval={smoothed ? 'weekly' : interval}
              renderType={renderType}
            />
          </>
        ))}
    </section>
  )
}
