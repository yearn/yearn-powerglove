import { useMemo, useState } from 'react'
import type { Strategy } from '@/types/dataTypes'
import type { SortDirection } from '@/utils/sortingUtils'

export type StrategySortColumn = 'name' | 'allocationPercent' | 'allocationAmount' | 'estimatedAPY'

export interface SortingAndFilteringState {
  sortColumn: StrategySortColumn
  sortDirection: SortDirection
  setSortColumn: (column: StrategySortColumn) => void
  setSortDirection: (direction: SortDirection) => void
  handleSort: (column: StrategySortColumn) => void
  sortedStrategies: Strategy[]
  allocatedStrategies: Strategy[]
  unallocatedStrategies: Strategy[]
}

function parseFormattedPercentage(percentage: string): number {
  return Number.parseFloat(percentage.replace(/[^0-9.]/g, ''))
}

export function useSortingAndFiltering(strategies: Strategy[]): SortingAndFilteringState {
  const [sortColumn, setSortColumn] = useState<StrategySortColumn>('allocationPercent')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const handleSort = (column: StrategySortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const sortedStrategies = useMemo(() => {
    return [...strategies].sort((a, b) => {
      switch (sortColumn) {
        case 'name':
          return sortDirection === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
        case 'allocationPercent':
          return sortDirection === 'asc'
            ? a.allocationPercent - b.allocationPercent
            : b.allocationPercent - a.allocationPercent
        case 'allocationAmount': {
          return sortDirection === 'asc'
            ? a.allocationAmountUsd - b.allocationAmountUsd
            : b.allocationAmountUsd - a.allocationAmountUsd
        }
        case 'estimatedAPY': {
          const aVal = parseFormattedPercentage(a.estimatedAPY)
          const bVal = parseFormattedPercentage(b.estimatedAPY)
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
        }
        default:
          return 0
      }
    })
  }, [strategies, sortColumn, sortDirection])

  const allocatedStrategies = useMemo(() => {
    return sortedStrategies.filter((strategy) => strategy.allocationPercent > 0)
  }, [sortedStrategies])

  const unallocatedStrategies = useMemo(() => {
    return sortedStrategies.filter((strategy) => strategy.allocationPercent === 0)
  }, [sortedStrategies])

  return {
    sortColumn,
    sortDirection,
    setSortColumn,
    setSortDirection,
    handleSort,
    sortedStrategies,
    allocatedStrategies,
    unallocatedStrategies
  }
}
