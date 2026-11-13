import React from 'react'
import { VirtualScrollTable } from '@/components/ui/VirtualScrollTable'
import { type VaultIconStyle, type VaultListData, VaultRow } from '@/components/vaults-list/VaultRow'

interface VaultsTableProps {
  vaults: VaultListData[]
  iconStyle?: VaultIconStyle
  availableHeight: number
}

export const VaultsTable: React.FC<VaultsTableProps> = React.memo(({ vaults, availableHeight, iconStyle }) => {
  // Show fallback message when no vaults match the filters
  if (vaults.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-500 text-center p-8"
        style={{ height: availableHeight }}
      >
        <div>
          <p className="text-lg font-medium mb-2">No vaults found with those filters.</p>
          <p className="text-sm">Please adjust your filters.</p>
        </div>
      </div>
    )
  }

  return (
    <VirtualScrollTable
      data={vaults}
      itemHeight={50} // Fixed height per row - matches VaultRow height
      containerHeight={availableHeight} // Use full available viewport height
      renderItem={(vault: VaultListData) => (
        <VaultRow iconStyle={iconStyle} key={`${vault.chain}-${vault.id}`} vault={vault} />
      )}
      className="border-0 overscroll-contain"
      overscan={3} // Render 3 extra items outside viewport
    />
  )
})
