import { useMemo, useState } from 'react'
import type { VaultListData } from '@/components/vaults-list/VaultRow'
import { getChainIdByName } from '@/constants/chains'
import { parseCompactDisplayNumber } from '@/lib/formatters'
import type { SortDirection } from '@/utils/sortingUtils'

export type VaultSortColumn = keyof VaultListData

export const TVL_RANGES = [
  { id: 'under-100k', label: 'Under $100K', min: 0, max: 100000 },
  { id: '100k-1m', label: '$100K – $1M', min: 100000, max: 1000000 },
  { id: '1m-10m', label: '$1M – $10M', min: 1000000, max: 10000000 },
  { id: 'over-10m', label: '$10M and above', min: 10000000, max: Infinity }
] as const

export interface VaultFilters {
  assets?: string[]
  chains: number[]
  types: string[]
  versions: string[]
  tvlRanges: string[]
  tvlMin: string
  tvlMax: string
  showRetired: boolean
}

export const defaultVaultFilters = (): VaultFilters => ({
  assets: [],
  chains: [],
  types: [],
  versions: [],
  tvlRanges: [],
  tvlMin: '',
  tvlMax: '',
  showRetired: false
})

const compareNumbers = (valueA: number, valueB: number, direction: number): number => {
  if (Number.isNaN(valueA) && Number.isNaN(valueB)) return 0
  if (Number.isNaN(valueA)) return 1
  if (Number.isNaN(valueB)) return -1
  return direction * (valueA - valueB)
}

export function sortVaults(
  vaultListData: VaultListData[],
  sortColumn: VaultSortColumn,
  sortDirection: SortDirection
): VaultListData[] {
  const direction = sortDirection === 'asc' ? 1 : -1
  return [...vaultListData].sort((a, b) => {
    if (sortColumn === 'tvl') {
      const valueA = parseCompactDisplayNumber(a.tvl)
      const valueB = parseCompactDisplayNumber(b.tvl)
      return compareNumbers(valueA, valueB, direction)
    }

    if (sortColumn === 'APY') {
      const displaySort = compareNumbers(a.apySortValue, b.apySortValue, direction)
      if (displaySort !== 0) {
        return displaySort
      }
      return compareNumbers(a.apyRawValue, b.apyRawValue, direction)
    }

    if (sortColumn === 'estimatedAPY') {
      return compareNumbers(a.estimatedApySortValue, b.estimatedApySortValue, direction)
    }

    const valueA = String(a[sortColumn])
    const valueB = String(b[sortColumn])
    return direction * valueA.localeCompare(valueB)
  })
}

export function customTvlBounds(filters: Pick<VaultFilters, 'tvlMin' | 'tvlMax'>) {
  const min = filters.tvlMin === '' ? null : Number(filters.tvlMin)
  const max = filters.tvlMax === '' ? null : Number(filters.tvlMax)
  const invalid =
    (min !== null && (!Number.isFinite(min) || min < 0)) ||
    (max !== null && (!Number.isFinite(max) || max < 0)) ||
    (min !== null && max !== null && min > max)
  return { min, max, invalid, active: min !== null || max !== null }
}

export function filterVaults(vaults: VaultListData[], searchTerm: string, filters: VaultFilters): VaultListData[] {
  const term = searchTerm.trim().toLowerCase()
  const bounds = customTvlBounds(filters)
  if (bounds.invalid) return []
  return vaults.filter((vault) => {
    if (!filters.showRetired && vault.isRetired === true) return false
    if (term && !vault.name.toLowerCase().includes(term) && !vault.token.toLowerCase().includes(term)) return false
    if (filters.assets?.length && !filters.assets.includes(vault.token)) return false
    const chainId = getChainIdByName(vault.chain)
    if (filters.chains.length && (chainId === undefined || !filters.chains.includes(chainId))) return false
    if (filters.types.length && !filters.types.includes(vault.type)) return false
    if (filters.versions.length && !filters.versions.includes(vault.apiVersion || 'Unknown')) return false
    if (bounds.active) {
      const tvl = vault.tvlUsd
      if (tvl == null || !Number.isFinite(tvl)) return false
      if ((bounds.min !== null && tvl < bounds.min) || (bounds.max !== null && tvl > bounds.max)) return false
    }
    if (filters.tvlRanges.length) {
      const tvl = vault.tvlUsd
      if (tvl == null || !Number.isFinite(tvl)) return false
      if (!TVL_RANGES.some((range) => filters.tvlRanges.includes(range.id) && tvl >= range.min && tvl < range.max))
        return false
    }
    return true
  })
}

export function useVaultFiltering(vaultListData: VaultListData[]) {
  const [sortColumn, setSortColumn] = useState<VaultSortColumn>('tvl')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState<VaultFilters>(defaultVaultFilters)

  const handleSort = (column: VaultSortColumn) => {
    if (sortColumn === column) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const filteredAndSortedVaults = useMemo(
    () => sortVaults(filterVaults(vaultListData, searchTerm, filters), sortColumn, sortDirection),
    [vaultListData, searchTerm, filters, sortColumn, sortDirection]
  )

  return {
    sortColumn,
    sortDirection,
    searchTerm,
    filters,
    setFilters,
    setSortColumn,
    setSortDirection,
    setSearchTerm,
    handleSort,
    filteredAndSortedVaults
  }
}
