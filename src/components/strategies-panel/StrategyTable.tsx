import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react'
import React from 'react'
import { useIsMobile } from '@/components/ui/use-mobile'
import type { StrategySortColumn } from '@/hooks/useSortingAndFiltering'
import { cn } from '@/lib/utils'
import type { Strategy } from '@/types/dataTypes'
import type { KongVaultSnapshotComposition } from '@/types/kong'
import type { SortDirection } from '@/utils/sortingUtils'
import type { NormalizationContext } from './KongDataTab'
import { StrategyRow } from './StrategyRow'

interface StrategyTableProps {
  allocatedStrategies: Strategy[]
  unallocatedStrategies: Strategy[]
  sortColumn: StrategySortColumn
  sortDirection: SortDirection
  onSort: (column: StrategySortColumn) => void
  expandedRow: number | null
  onToggleRow: (id: number) => void
  showUnallocated: boolean
  onToggleUnallocated: () => void
  strategyCompositionByAddress?: Map<string, KongVaultSnapshotComposition>
  kongNormalizationContext?: NormalizationContext | null
}

export const StrategyTable: React.FC<StrategyTableProps> = React.memo(
  ({
    allocatedStrategies,
    unallocatedStrategies,
    sortColumn,
    sortDirection,
    onSort,
    expandedRow,
    onToggleRow,
    showUnallocated,
    onToggleUnallocated,
    strategyCompositionByAddress,
    kongNormalizationContext
  }) => {
    const isMobile = useIsMobile()

    const renderSortIcon = (column: StrategySortColumn) => {
      if (sortColumn !== column) {
        return <ChevronDown className="w-4 h-4 ml-1 inline-block" />
      }
      return sortDirection === 'asc' ? (
        <ChevronUp className="w-4 h-4 ml-1 inline-block text-[#0657f9]" />
      ) : (
        <ChevronDown className="w-4 h-4 ml-1 inline-block text-[#0657f9]" />
      )
    }

    return (
      <div className="w-full">
        <div className="border border-[#f5f5f5]">
          {isMobile ? (
            <div className="border-b border-[#f5f5f5] p-3">
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#808080]">Sort strategies</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { column: 'allocationPercent', label: 'Allocation %' },
                  { column: 'allocationAmount', label: 'amount' },
                  { column: 'estimatedAPY', label: 'APY' }
                ].map(({ column, label }) => (
                  <button
                    key={column}
                    type="button"
                    onClick={() => onSort(column as StrategySortColumn)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      sortColumn === column
                        ? 'border-[#0657f9] bg-[#0657f9]/10 text-[#0657f9]'
                        : 'border-[#e5e5e5] text-[#4f4f4f] hover:bg-[#f5f5f5]'
                    )}
                  >
                    {label}
                    {renderSortIcon(column as StrategySortColumn)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center p-3 text-sm text-[#4f4f4f]">
              <div className="flex w-1/2 items-center">
                <span className="ml-8 whitespace-nowrap">Vault</span>
              </div>
              <div
                className="w-1/6 cursor-pointer whitespace-nowrap text-right"
                onClick={() => onSort('allocationPercent')}
              >
                <span>Allocation %</span>
                {renderSortIcon('allocationPercent')}
              </div>
              <div
                className="w-1/6 cursor-pointer whitespace-nowrap text-right"
                onClick={() => onSort('allocationAmount')}
              >
                <span>amount</span>
                {renderSortIcon('allocationAmount')}
              </div>
              <div className="w-1/6 cursor-pointer whitespace-nowrap text-right" onClick={() => onSort('estimatedAPY')}>
                <span>APY</span>
                {renderSortIcon('estimatedAPY')}
              </div>
            </div>
          )}

          {allocatedStrategies.map((strategy) => (
            <StrategyRow
              key={strategy.id}
              strategy={strategy}
              isExpanded={expandedRow === strategy.id}
              onToggle={() => onToggleRow(strategy.id)}
              composition={strategyCompositionByAddress?.get(strategy.details.vaultAddress.toLowerCase())}
              kongNormalizationContext={kongNormalizationContext}
            />
          ))}

          {unallocatedStrategies.length > 0 && (
            <div className="border-t border-[#f5f5f5]">
              <div className="flex cursor-pointer items-center p-3 hover:bg-[#f5f5f5]/50" onClick={onToggleUnallocated}>
                <div className="flex w-8 justify-center">
                  {showUnallocated ? (
                    <ChevronDown className="w-4 h-4 text-[#4f4f4f]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[#4f4f4f]" />
                  )}
                </div>
                <div className="ml-2 flex-1 text-sm font-medium">
                  Unallocated Strategies
                  <span className="ml-2 text-xs font-normal text-[#808080]">({unallocatedStrategies.length})</span>
                </div>
              </div>
              {showUnallocated &&
                unallocatedStrategies.map((strategy) => (
                  <StrategyRow
                    key={strategy.id}
                    strategy={strategy}
                    isExpanded={expandedRow === strategy.id}
                    onToggle={() => onToggleRow(strategy.id)}
                    isUnallocated
                    composition={strategyCompositionByAddress?.get(strategy.details.vaultAddress.toLowerCase())}
                    kongNormalizationContext={kongNormalizationContext}
                  />
                ))}
            </div>
          )}
        </div>
      </div>
    )
  }
)
