import React from 'react'
import { VirtualScrollTable } from '@/components/ui/VirtualScrollTable'
import { MOBILE_VAULT_ROW_HEIGHT, type VaultListData, VaultMobileListRow } from '@/components/vaults-list/VaultRow'

interface VaultsMobileListProps {
  vaults: VaultListData[]
  availableHeight: number
}

const MOBILE_VAULT_LIST_HEADER_HEIGHT = 37

export const VaultsMobileList: React.FC<VaultsMobileListProps> = React.memo(({ vaults, availableHeight }) => {
  if (vaults.length === 0) {
    return (
      <div className="border bg-white p-6 text-center text-gray-500">
        <p className="mb-1 text-base font-medium text-gray-900">No vaults found with those filters.</p>
        <p className="text-sm">Please adjust your filters.</p>
      </div>
    )
  }

  const listHeight = Math.max(availableHeight - MOBILE_VAULT_LIST_HEADER_HEIGHT, MOBILE_VAULT_ROW_HEIGHT * 4)

  return (
    <div className="overflow-hidden border bg-white">
      <div className="grid grid-cols-[minmax(0,1.8fr)_4.5rem_5rem] items-center gap-x-3 border-b border-gray-200 bg-gray-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">
        <div>Vault</div>
        <div className="text-right">30D APY</div>
        <div className="text-right">TVL</div>
      </div>

      <VirtualScrollTable
        data={vaults}
        itemHeight={MOBILE_VAULT_ROW_HEIGHT}
        containerHeight={listHeight}
        renderItem={(vault, index) => <VaultMobileListRow vault={vault} isLast={index === vaults.length - 1} />}
        getItemKey={(vault) => `${vault.chain}-${vault.id}`}
        className="border-0"
        overscan={4}
      />
    </div>
  )
})
