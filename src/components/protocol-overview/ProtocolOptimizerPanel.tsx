import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import React, { useMemo, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FixedHeightChartContainer } from '@/components/charts/chart-container'
import type { ChainId } from '@/constants/chains'
import { CHAIN_ID_TO_ICON, CHAIN_ID_TO_NAME } from '@/constants/chains'
import { useProtocolOptimizations } from '@/hooks/useProtocolOptimizations'
import { formatPercent, formatTvlDisplay } from '@/lib/formatters'
import { fetchStrategyDisplayNames } from '@/lib/kong-strategy-names'
import type { ProtocolOptimizationItem, StrategyAllocationRow } from '@/lib/protocol-optimizations'

const vaultKey = (chainId: number | null, vault: string): string => `${chainId ?? 'x'}:${vault}`

// Format the optimizer's unix-seconds timestamp as "YYYY-MM-DD HH:MM:SS UTC",
// matching the timestamp shown on visual.yearn.dev.
function formatOptimizerUtc(seconds: number): string {
  const d = new Date(seconds * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`
}

interface VaultRowProps {
  item: ProtocolOptimizationItem
  selected: boolean
  onSelect: (key: string) => void
}

function VaultRow({ item, selected, onSelect }: VaultRowProps) {
  const chainId = item.chainId as ChainId | null
  const chainName = chainId ? CHAIN_ID_TO_NAME[chainId] : null
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(vaultKey(item.chainId, item.vault))}
        className={`w-full rounded-md px-2 py-2 text-left transition-colors ${
          selected ? 'bg-[#0657f9]/5 ring-1 ring-[#0657f9]/30' : 'hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-2">
          {chainId ? (
            <img src={CHAIN_ID_TO_ICON[chainId]} alt="" className="h-4 w-4 shrink-0 rounded-full" loading="lazy" />
          ) : (
            <span className="inline-block h-4 w-4 shrink-0 rounded-full bg-gray-200" />
          )}
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
            {item.vaultLabel ?? item.vault.slice(0, 10)}
          </span>
          {item.aprDeltaPct !== null ? (
            <span className="shrink-0 text-[11px] font-semibold text-emerald-600">
              +{formatPercent(item.aprDeltaPct)}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center gap-2 pl-6 text-[11px] text-gray-400">
          <span>{item.strategyCount} strats</span>
          {chainName ? <span>· {chainName}</span> : null}
          {item.tvlUsd !== null ? <span>· {formatTvlDisplay(item.tvlUsd)}</span> : null}
        </div>
      </button>
    </li>
  )
}

// Chart data: two rows (Before / After), one stacked column per strategy.
function buildAllocationChartData(strategies: StrategyAllocationRow[]) {
  const before: Record<string, number | string> = { label: 'Before' }
  const after: Record<string, number | string> = { label: 'After' }
  for (let i = 0; i < strategies.length; i++) {
    before[`s${i}`] = strategies[i].currentPct
    after[`s${i}`] = strategies[i].targetPct
  }
  return [before, after]
}

const tooltipFormatter = (value: number, name: string): [string, string] => [`${Number(value).toFixed(1)}%`, name]

/**
 * Compact recreation of visual.yearn.dev's core: a selectable sidebar of vaults
 * (ordered by APR delta) beside a Before/After strategy-allocation stacked bar
 * for the selected vault. Both panes run off the single global `/api/change`
 * fetch — each record already carries its strategy debt ratios — so selecting a
 * vault needs no follow-up request.
 */
function OptimizerPanelImpl() {
  const { vaults, isLoading, isError } = useProtocolOptimizations()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const selected = useMemo(() => {
    if (vaults.length === 0) return null
    return vaults.find((v) => vaultKey(v.chainId, v.vault) === selectedKey) ?? vaults[0]
  }, [vaults, selectedKey])

  const chartData = useMemo(() => (selected ? buildAllocationChartData(selected.strategies) : []), [selected])

  // Resolve real strategy names from Kong for the selected vault's chart — the
  // reallocation API only carries strategy addresses. Cached per vault; falls
  // back to the generic "Strategy N" label when a name can't be resolved.
  const strategyAddresses = selected?.strategies.map((s) => s.key) ?? []
  const strategyChainId = selected?.chainId ?? null
  const namesQuery = useQuery({
    queryKey: ['optimizer', 'strategy-names', strategyChainId, strategyAddresses],
    queryFn: async () => {
      if (strategyChainId === null) return {}
      const map = await fetchStrategyDisplayNames(strategyChainId, strategyAddresses)
      const names: Record<string, string> = {}
      for (const [address, info] of Object.entries(map)) names[address] = info.name
      return names
    },
    enabled: strategyChainId !== null && strategyAddresses.length > 0,
    staleTime: 15 * 60 * 1000
  })
  const strategyNames = namesQuery.data ?? {}
  const namedStrategies = useMemo(
    () => (selected ? selected.strategies.map((s) => ({ ...s, name: strategyNames[s.key] ?? s.name })) : []),
    [selected, strategyNames]
  )

  return (
    <section className="border border-border bg-white">
      <div className="flex items-center justify-between p-4 pb-2 sm:p-6 sm:pb-2">
        <h2 className="text-sm font-semibold text-foreground">Vault optimizer</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 pt-2 pb-2 sm:p-6 sm:pt-2 sm:pb-2 lg:grid-cols-3">
        {/* Sidebar list */}
        <div className="lg:col-span-1">
          {/* Sidebar capped below the chart column's natural height so the section bottom follows the legend, not the taller vault list. */}
          <div className="max-h-[300px] overflow-y-auto pr-1">
            {isError ? (
              <div className="px-2 py-6 text-center text-xs text-gray-400">Optimizations unavailable</div>
            ) : isLoading && vaults.length === 0 ? (
              <div className="px-2 py-6 text-center text-xs text-gray-400">Loading…</div>
            ) : vaults.length === 0 ? (
              <div className="px-2 py-6 text-center text-xs text-gray-400">No optimizations</div>
            ) : (
              <ul className="space-y-0.5">
                {vaults.map((item) => (
                  <VaultRow
                    key={vaultKey(item.chainId, item.vault)}
                    item={item}
                    selected={
                      vaultKey(item.chainId, item.vault) === vaultKey(selected?.chainId ?? null, selected?.vault ?? '')
                    }
                    onSelect={setSelectedKey}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Allocation chart */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="flex h-[260px] items-center justify-center text-xs text-gray-400">Select a vault</div>
          ) : selected.strategies.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-xs text-gray-400">No allocation data</div>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-xs font-medium text-foreground">
                  {selected.vaultLabel ?? selected.vault.slice(0, 10)}
                </span>
                {selected.currentAprPct !== null && selected.proposedAprPct !== null ? (
                  <span className="text-xs text-gray-500">
                    {formatPercent(selected.currentAprPct)} →{' '}
                    <span className="font-medium text-emerald-600">{formatPercent(selected.proposedAprPct)} APR</span>
                  </span>
                ) : null}
                {selected.timestampSeconds !== null ? (
                  <span className="text-[11px] text-gray-400">
                    Last optimized {formatOptimizerUtc(selected.timestampSeconds)}
                  </span>
                ) : null}
                <Link
                  to="/vaults/$chainId/$vaultAddress"
                  params={{ chainId: (selected.chainId ?? 1).toString(), vaultAddress: selected.vault }}
                  className="ml-auto text-[11px] text-[#0657f9] underline-offset-2 hover:underline"
                >
                  view vault
                </Link>
              </div>
              <FixedHeightChartContainer heightClassName="h-[200px] sm:h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tickFormatter={(v: number) => `${v}%`}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      tick={{ fontSize: 12, fill: '#374151', fontWeight: 600 }}
                      tickLine={false}
                      axisLine={false}
                      width={52}
                    />
                    <Tooltip
                      formatter={tooltipFormatter}
                      cursor={{ fill: 'rgba(6,87,249,0.05)' }}
                      contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, background: '#fff' }}
                    />
                    {namedStrategies.map((strategy, index) => (
                      <Bar
                        key={strategy.key}
                        dataKey={`s${index}`}
                        name={strategy.name}
                        stackId="alloc"
                        fill={strategy.color}
                        isAnimationActive={false}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </FixedHeightChartContainer>

              {/* Strategy legend: color + current→target allocation per strategy */}
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {namedStrategies.map((strategy) => (
                  <div key={strategy.key} className="flex items-center gap-1" title={strategy.shortAddress}>
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: strategy.color }}
                    />
                    <span className="max-w-[140px] truncate text-[11px] font-medium text-gray-700">
                      {strategy.name}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {strategy.currentPct.toFixed(0)}% → {strategy.targetPct.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

export const ProtocolOptimizerPanel = React.memo(OptimizerPanelImpl)
