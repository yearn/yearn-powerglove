import { ChevronDown, ChevronUp, ListFilter } from 'lucide-react'
import React from 'react'
import type { VaultListData } from '@/components/vaults-list/VaultRow'
import type { SortDirection } from '@/utils/sortingUtils'

interface VaultsTableHeaderProps {
  sortColumn: keyof VaultListData
  sortDirection: SortDirection
  onFilter?: (filter: 'assets' | 'chains' | 'types') => void
  onSort: (column: keyof VaultListData) => void
}

const headers: { label: string; key: keyof VaultListData }[] = [
  { label: 'Vault', key: 'name' },
  { label: 'Est. APY', key: 'estimatedAPY' },
  { label: '30D APY', key: 'APY' },
  { label: 'TVL', key: 'tvl' },
  { label: 'Asset', key: 'token' },
  { label: 'Chain', key: 'chain' },
  { label: 'Type', key: 'type' }
]

export const VaultsTableHeader: React.FC<VaultsTableHeaderProps> = React.memo(
  ({ sortColumn, sortDirection, onSort, onFilter }) => {
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

    const renderHeader = ({ label, key }: (typeof headers)[number]) => {
      const filter = key === 'token' ? 'assets' : key === 'chain' ? 'chains' : key === 'type' ? 'types' : undefined
      return (
        <button
          key={key}
          className={`min-w-0 flex items-center gap-1 select-none p-0 bg-transparent cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0657f9] ${key === 'name' ? 'justify-start' : 'justify-end'}`}
          type="button"
          aria-label={filter ? `Filter by ${label}` : `Sort by ${label}. Current sort: ${getSortState(key)}.`}
          aria-haspopup={filter ? 'dialog' : undefined}
          aria-pressed={filter ? undefined : sortColumn === key}
          onClick={() => (filter ? onFilter?.(filter) : onSort(key))}
        >
          <span>{label}</span>
          {filter ? <ListFilter className="w-4 h-4" aria-hidden /> : renderSortIcon(key)}
        </button>
      )
    }

    return (
      <div className="grid shrink-0 grid-cols-[minmax(0,2fr)_minmax(0,3fr)_minmax(0,2fr)] gap-x-6 pl-6 pr-10 py-2 bg-white text-gray-900 font-medium border-b">
        {renderHeader(headers[0])}
        <div className="relative -left-24 grid w-full min-w-0 max-w-96 grid-cols-3 items-center gap-x-1 justify-self-end">
          {headers.slice(1, 4).map(renderHeader)}
        </div>
        <div className="grid w-full min-w-0 max-w-96 grid-cols-3 items-center gap-x-1 justify-self-end">
          {headers.slice(4).map(renderHeader)}
        </div>
      </div>
    )
  }
)
