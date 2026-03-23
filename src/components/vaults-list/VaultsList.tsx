import React from 'react'
import { useIsMobile } from '@/components/ui/use-mobile'
import { YearnVaultsSummary } from '@/components/YearnVaultsSummary'
import { useViewportHeight } from '@/hooks/useResponsiveHeight'
import { useVaultFiltering } from '@/hooks/useVaultFiltering'
import { useVaultListData } from '@/hooks/useVaultListData'
import type { TokenAsset } from '@/types/tokenAsset'
import type { Vault } from '@/types/vaultTypes'
import { VaultsFilterBar } from './VaultsFilterBar'
import { VaultsMobileList } from './VaultsMobileList'
import { VaultsTable } from './VaultsTable'
import { VaultsTableHeader } from './VaultsTableHeader'

interface VaultsListProps {
  vaults: Vault[]
  tokenAssets: TokenAsset[]
}

export const VaultsList: React.FC<VaultsListProps> = React.memo(({ vaults, tokenAssets }) => {
  const isMobile = useIsMobile()

  // Calculate available height for virtual scrolling container
  const availableHeight = useViewportHeight({
    headerHeight: 53, // Header height
    footerHeight: 53, // Fixed footer height
    extraOffset: 200 // Summary, table headers, search bar, margins
  })

  // Use our custom hooks for data transformation and filtering
  const vaultListData = useVaultListData(vaults, tokenAssets)
  const {
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
  } = useVaultFiltering(vaultListData)

  return (
    <div>
      <YearnVaultsSummary />
      {/* Filters Bar */}
      <VaultsFilterBar
        selectedChains={selectedChains}
        selectedTypes={selectedTypes}
        searchTerm={searchTerm}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onChainToggle={handleToggleChain}
        onSetSelectedChains={setSelectedChains}
        onTypeToggle={handleToggleType}
        onSetSelectedTypes={setSelectedTypes}
        onSearchChange={setSearchTerm}
        onSortColumnChange={setSortColumn}
        onSortDirectionChange={setSortDirection}
      />

      {/* Vaults List */}
      {isMobile ? (
        <VaultsMobileList vaults={filteredAndSortedVaults} />
      ) : (
        <div className="overflow-hidden rounded border bg-white text-sm">
          <VaultsTableHeader sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
          <VaultsTable vaults={filteredAndSortedVaults} availableHeight={availableHeight} />
        </div>
      )}
    </div>
  )
})
