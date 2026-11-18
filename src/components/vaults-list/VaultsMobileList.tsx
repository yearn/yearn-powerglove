import { ArrowDown, ArrowUp } from 'lucide-react'
import React from 'react'
import { VirtualScrollTable } from '@/components/ui/VirtualScrollTable'
import {
  MOBILE_VAULT_ROW_HEIGHT,
  type VaultIconStyle,
  type VaultListData,
  VaultMobileListRow
} from '@/components/vaults-list/VaultRow'
import type { VaultSortColumn } from '@/hooks/useVaultFiltering'
import type { SortDirection } from '@/utils/sortingUtils'

interface VaultsMobileListProps {
  vaults: VaultListData[]
  iconStyle?: VaultIconStyle
  availableHeight: number
  sortColumn: VaultSortColumn
  sortDirection: SortDirection
  onSort: (column: VaultSortColumn) => void
}

const MOBILE_VAULT_LIST_HEADER_HEIGHT = 37

export const VaultsMobileList: React.FC<VaultsMobileListProps> = React.memo(
  ({ vaults, availableHeight, sortColumn, sortDirection, onSort, iconStyle }) => {
    if (vaults.length === 0) {
      return (
        <div className="border bg-white p-6 text-center text-gray-500">
          <p className="mb-1 text-base font-medium text-gray-900">No vaults found with those filters.</p>
          <p className="text-sm">Please adjust your filters.</p>
        </div>
      )
    }

    const listHeight = Math.max(availableHeight - MOBILE_VAULT_LIST_HEADER_HEIGHT, 0)

    return (
      <div className="overflow-hidden border bg-white">
        <div className="grid grid-cols-[minmax(0,1.8fr)_4.5rem_5rem] items-center gap-x-3 border-b border-gray-200 bg-gray-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">
          {(
            [
              ['name', 'Vault'],
              ['APY', '30D APY'],
              ['tvl', 'TVL']
            ] as const
          ).map(([column, label]) => (
            <button
              type="button"
              key={column}
              onClick={() => onSort(column)}
              aria-label={`Sort by ${label}${sortColumn === column ? `, currently ${sortDirection === 'asc' ? 'ascending' : 'descending'}` : ''}`}
              className={`flex items-center gap-1 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${column === 'name' ? 'justify-start' : 'justify-end'} ${sortColumn === column ? 'text-foreground' : ''}`}
            >
              {label}
              {sortColumn === column &&
                (sortDirection === 'asc' ? (
                  <ArrowUp size={11} aria-hidden="true" />
                ) : (
                  <ArrowDown size={11} aria-hidden="true" />
                ))}
            </button>
          ))}
        </div>

        <VirtualScrollTable
          data={vaults}
          itemHeight={MOBILE_VAULT_ROW_HEIGHT}
          containerHeight={listHeight}
          renderItem={(vault, index) => (
            <VaultMobileListRow iconStyle={iconStyle} vault={vault} isLast={index === vaults.length - 1} />
          )}
          getItemKey={(vault) => `${vault.chain}-${vault.id}`}
          className="border-0 overscroll-contain"
          overscan={4}
        />
      </div>
    )
  }
)
