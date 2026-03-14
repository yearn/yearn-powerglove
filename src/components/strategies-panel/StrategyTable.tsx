import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react'
import React from 'react'
import type { StrategySortColumn } from '@/hooks/useSortingAndFiltering'
import type { Strategy } from '@/types/dataTypes'
import type { SortDirection } from '@/utils/sortingUtils'
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
    onToggleUnallocated
  }) => {
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
          {/* Table Header */}
          <div className="flex items-center p-3 text-sm text-[#4f4f4f]">
            <div className="w-1/2 flex items-center">
              <span className="ml-8 whitespace-nowrap">Vault</span>
            </div>
            <div
              className="w-1/6 text-right whitespace-nowrap cursor-pointer"
              onClick={() => onSort('allocationPercent')}
            >
              <span>Allocation %</span>
              {renderSortIcon('allocationPercent')}
            </div>
            <div
              className="w-1/6 text-right whitespace-nowrap cursor-pointer"
              onClick={() => onSort('allocationAmount')}
            >
              <span>Allocation $</span>
              {renderSortIcon('allocationAmount')}
            </div>
            <div className="w-1/6 text-right whitespace-nowrap cursor-pointer" onClick={() => onSort('estimatedAPY')}>
              <span>Est. APY</span>
              {renderSortIcon('estimatedAPY')}
            </div>
          </div>

          {/* Allocated Strategies Table Rows */}
          {allocatedStrategies.map((strategy) => (
            <StrategyRow
              key={strategy.id}
              strategy={strategy}
              isExpanded={expandedRow === strategy.id}
              onToggle={() => onToggleRow(strategy.id)}
            />
          ))}

          {/* Accordion for Unallocated Strategies */}
          {unallocatedStrategies.length > 0 && (
            <div className="border-t border-[#f5f5f5]">
              <div className="flex items-center p-3 hover:bg-[#f5f5f5]/50 cursor-pointer" onClick={onToggleUnallocated}>
                <div className="w-8 flex justify-center">
                  {showUnallocated ? (
                    <ChevronDown className="w-4 h-4 text-[#4f4f4f]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[#4f4f4f]" />
                  )}
                </div>
                <div className="flex-1 ml-2 text-sm font-medium">View unallocated strategies</div>
              </div>
              {showUnallocated &&
                unallocatedStrategies.map((strategy) => (
                  <StrategyRow
                    key={strategy.id}
                    strategy={strategy}
                    isExpanded={expandedRow === strategy.id}
                    onToggle={() => onToggleRow(strategy.id)}
                    isUnallocated
                  />
                ))}
            </div>
          )}
        </div>
      </div>
    )
  }
)
