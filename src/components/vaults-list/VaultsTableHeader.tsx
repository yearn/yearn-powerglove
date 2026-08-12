import { ChevronDown, ChevronUp } from 'lucide-react'
import React from 'react'
import type { VaultListData } from '@/components/vaults-list/VaultRow'
import type { SortDirection } from '@/utils/sortingUtils'

interface VaultsTableHeaderProps {
  sortColumn: keyof VaultListData
  sortDirection: SortDirection
  onSort: (column: keyof VaultListData) => void
}

const headers: { label: string; key: keyof VaultListData }[] = [
  { label: 'Vault', key: 'name' },
  { label: 'Chain', key: 'chain' },
  { label: 'Token', key: 'token' },
  { label: 'Type', key: 'type' },
  { label: 'Est. APY', key: 'estimatedAPY' },
  { label: '30D APY', key: 'APY' },
  { label: 'TVL', key: 'tvl' }
]

export const VaultsTableHeader: React.FC<VaultsTableHeaderProps> = React.memo(
  ({ sortColumn, sortDirection, onSort }) => {
    const renderSortIcon = (column: keyof VaultListData) => {
      if (sortColumn !== column) {
        return <ChevronDown className="w-4 h-4 inline-block" aria-hidden />
      }
      return sortDirection === 'asc' ? (
        <ChevronUp className="w-4 h-4 inline-block text-[#0657f9]" aria-hidden />
      ) : (
        <ChevronDown className="w-4 h-4 inline-block text-[#0657f9]" aria-hidden />
      )
    }

    const getSortState = (column: keyof VaultListData) => {
      if (sortColumn !== column) {
        return 'none'
      }
      return sortDirection === 'asc' ? 'ascending' : 'descending'
    }

    return (
      <div className="flex px-6 py-2 bg-white text-gray-900 font-medium border-b">
        {headers.map(({ label, key }) => (
          <button
            key={key}
            className={`flex items-center gap-1 select-none p-0 bg-transparent cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0657f9] ${
              key === 'name' ? 'flex-[2] justify-start' : 'flex-1 justify-end'
            }`}
            type="button"
            aria-label={`Sort by ${label}. Current sort: ${getSortState(key)}.`}
            aria-pressed={sortColumn === key}
            onClick={() => onSort(key)}
          >
            <span>{label}</span>
            {renderSortIcon(key)}
          </button>
        ))}
      </div>
    )
  }
)
