import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react'
import React, { useState } from 'react'
import { CHAIN_ID_TO_BLOCK_EXPLORER } from '@/constants/chains'
import { formatPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { ReallocationStrategy } from '@/types/reallocationTypes'

type SortKey = 'name' | 'currentRatio' | 'targetRatio' | 'allocationDelta' | 'currentApr' | 'targetApr' | 'aprDelta'
type SortDirection = 'asc' | 'desc'

interface SortConfig {
  key: SortKey
  direction: SortDirection
}

function getExplorerUrl(chainId: number | null, address: string): string {
  if (chainId !== null && chainId in CHAIN_ID_TO_BLOCK_EXPLORER) {
    return `${CHAIN_ID_TO_BLOCK_EXPLORER[chainId as keyof typeof CHAIN_ID_TO_BLOCK_EXPLORER]}/address/${address}`
  }
  return `https://etherscan.io/address/${address}`
}

function formatAddress(address: string): string {
  if (address.length < 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function SortHeader({ label, sortKey, onSort }: { label: string; sortKey: SortKey; onSort: (key: SortKey) => void }) {
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 text-xs font-medium uppercase tracking-[0.08em] text-[#808080] hover:text-[#1a1a1a]"
    >
      {label}
      <ArrowUpDown className="h-3 w-3 opacity-50" />
    </button>
  )
}

interface ReallocationStrategyTableProps {
  strategies: ReallocationStrategy[]
  chainId: number | null
}

export const ReallocationStrategyTable: React.FC<ReallocationStrategyTableProps> = React.memo(
  ({ strategies, chainId }) => {
    const [sortConfig, setSortConfig] = useState<SortConfig>({
      key: 'allocationDelta',
      direction: 'desc'
    })
    const [isExpanded, setIsExpanded] = useState(true)

    const sortedStrategies = React.useMemo(() => {
      return [...strategies].sort((a, b) => {
        let aValue: number
        let bValue: number

        switch (sortConfig.key) {
          case 'name':
            return sortConfig.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
          case 'currentRatio':
            aValue = a.currentRatioPct
            bValue = b.currentRatioPct
            break
          case 'targetRatio':
            aValue = a.targetRatioPct
            bValue = b.targetRatioPct
            break
          case 'allocationDelta':
            aValue = a.allocationDeltaPct
            bValue = b.allocationDeltaPct
            break
          case 'currentApr':
            aValue = a.currentAprPct ?? 0
            bValue = b.currentAprPct ?? 0
            break
          case 'targetApr':
            aValue = a.targetAprPct ?? 0
            bValue = b.targetAprPct ?? 0
            break
          case 'aprDelta':
            aValue = a.aprDeltaPct ?? 0
            bValue = b.aprDeltaPct ?? 0
            break
          default:
            return 0
        }

        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
      })
    }, [strategies, sortConfig])

    const handleSort = (key: SortKey) => {
      setSortConfig((current) => ({
        key,
        direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
      }))
    }

    const activeStrategies = strategies.filter((s) => !s.isUnallocated)

    return (
      <div className="rounded-lg border border-[#f5f5f5]">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full items-center justify-between px-4 py-3 hover:bg-[#f5f5f5]/30"
        >
          <h3 className="font-semibold text-[#1a1a1a]">
            Strategy Details
            <span className="ml-2 text-sm font-normal text-[#808080]">({activeStrategies.length} strategies)</span>
          </h3>
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-[#808080]" />
          ) : (
            <ChevronUp className="h-5 w-5 text-[#808080]" />
          )}
        </button>

        {isExpanded && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#f5f5f5]/50">
                <tr className="border-b border-[#f5f5f5] text-left">
                  <th className="px-4 py-3">
                    <SortHeader label="Strategy" sortKey="name" onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SortHeader label="Current" sortKey="currentRatio" onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SortHeader label="Target" sortKey="targetRatio" onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SortHeader label="Δ Alloc" sortKey="allocationDelta" onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SortHeader label="Current APR" sortKey="currentApr" onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SortHeader label="Target APR" sortKey="targetApr" onSort={handleSort} />
                  </th>
                  <th className="px-4 py-3 text-right">
                    <SortHeader label="Δ APR" sortKey="aprDelta" onSort={handleSort} />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f5f5f5] text-sm">
                {sortedStrategies.map((strategy) => {
                  const isIncreasing = strategy.allocationDeltaPct >= 0
                  const aprIncreasing = strategy.aprDeltaPct !== null && strategy.aprDeltaPct >= 0
                  const displayAddress = strategy.strategyAddress ?? strategy.strategyKey

                  return (
                    <tr
                      key={strategy.strategyKey}
                      className={cn('hover:bg-[#f5f5f5]/30', strategy.isUnallocated && 'opacity-50')}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: strategy.color }} />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-[#1a1a1a]">{strategy.name}</div>
                            {!strategy.isUnallocated && strategy.strategyAddress && (
                              <a
                                href={getExplorerUrl(chainId, displayAddress)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-xs text-[#0657f9] hover:underline"
                              >
                                {formatAddress(displayAddress)}
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#1a1a1a]">
                        {formatPercent(strategy.currentRatioPct)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#1a1a1a]">
                        {formatPercent(strategy.targetRatioPct)}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-right font-medium tabular-nums',
                          isIncreasing ? 'text-green-600' : 'text-red-600'
                        )}
                      >
                        {isIncreasing ? '+' : ''}
                        {formatPercent(strategy.allocationDeltaPct)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#4f4f4f]">
                        {formatPercent(strategy.currentAprPct)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#4f4f4f]">
                        {formatPercent(strategy.targetAprPct)}
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-right font-medium tabular-nums',
                          strategy.aprDeltaPct === null
                            ? 'text-[#808080]'
                            : aprIncreasing
                              ? 'text-green-600'
                              : 'text-red-600'
                        )}
                      >
                        {strategy.aprDeltaPct === null
                          ? 'N/A'
                          : `${aprIncreasing ? '+' : ''}${formatPercent(strategy.aprDeltaPct)}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }
)
