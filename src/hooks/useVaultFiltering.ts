import { useMemo, useState } from 'react'
import type { VaultListData } from '@/components/vaults-list/VaultRow'
import { getChainIdByName } from '@/constants/chains'
import { parseCompactDisplayNumber } from '@/lib/formatters'
import type { SortDirection } from '@/utils/sortingUtils'

export type VaultSortColumn = keyof VaultListData

export interface VaultFilteringState {
  sortColumn: VaultSortColumn
  sortDirection: SortDirection
  searchTerm: string
  selectedChains: number[]
  selectedTypes: string[]
  setSortColumn: (column: VaultSortColumn) => void
  setSortDirection: (direction: SortDirection) => void
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>
  setSelectedChains: React.Dispatch<React.SetStateAction<number[]>>
  setSelectedTypes: React.Dispatch<React.SetStateAction<string[]>>
  handleSort: (column: VaultSortColumn) => void
  handleToggleChain: (chainId: number) => void
  handleToggleType: (type: string) => void
  filteredAndSortedVaults: VaultListData[]
}

const compareNumbers = (valueA: number, valueB: number): number => {
  if (Number.isNaN(valueA) && Number.isNaN(valueB)) return 0
  if (Number.isNaN(valueA)) return 1
  if (Number.isNaN(valueB)) return -1
  return valueA - valueB
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
      return direction * compareNumbers(valueA, valueB)
    }

    if (sortColumn === 'APY') {
      const displaySort = compareNumbers(a.apySortValue, b.apySortValue)
      if (displaySort !== 0) {
        return direction * displaySort
      }
      return direction * compareNumbers(a.apyRawValue, b.apyRawValue)
    }

    const valueA = String(a[sortColumn])
    const valueB = String(b[sortColumn])
    return direction * valueA.localeCompare(valueB)
  })
}

function filterVaults(
  vaultListData: VaultListData[],
  searchTerm: string,
  selectedChains: number[],
  selectedTypes: string[]
): VaultListData[] {
  const term = searchTerm.trim().toLowerCase()
  return vaultListData.filter((vault) => {
    // Search across name and token
    const matchesSearch = !term || vault.name.toLowerCase().includes(term) || vault.token.toLowerCase().includes(term)

    // Chain filter (if any selected chains, only include those)
    const vaultChainId = getChainIdByName(vault.chain)
    const matchesChain =
      selectedChains.length === 0 || (vaultChainId !== undefined && selectedChains.includes(vaultChainId))

    // Type filter
    const matchesType = selectedTypes.length === 0 || selectedTypes.includes(vault.type)

    return matchesSearch && matchesChain && matchesType
  })
}

export function useVaultFiltering(vaultListData: VaultListData[]): VaultFilteringState {
  const [sortColumn, setSortColumn] = useState<VaultSortColumn>('tvl')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [selectedChains, setSelectedChains] = useState<number[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])

  const handleSort = (column: VaultSortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const handleToggleChain = (chainId: number) => {
    setSelectedChains((prev) => (prev.includes(chainId) ? prev.filter((id) => id !== chainId) : [...prev, chainId]))
  }

  const handleToggleType = (type: string) => {
    setSelectedTypes((prev) => {
      return prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    })
  }

  // Apply filtering and sorting
  const filteredAndSortedVaults = useMemo(() => {
    const filtered = filterVaults(vaultListData, searchTerm, selectedChains, selectedTypes)
    return sortVaults(filtered, sortColumn, sortDirection)
  }, [vaultListData, searchTerm, selectedChains, selectedTypes, sortColumn, sortDirection])

  return {
    sortColumn,
    sortDirection,
    searchTerm,
    selectedChains,
    selectedTypes,
    setSortColumn,
    setSortDirection,
    setSearchTerm,
    setSelectedChains,
    setSelectedTypes,
    handleSort,
    handleToggleChain,
    handleToggleType,
    filteredAndSortedVaults
  }
}
