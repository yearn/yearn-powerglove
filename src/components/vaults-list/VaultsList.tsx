import React, { useLayoutEffect, useState } from 'react'
import { useIsMobile } from '@/components/ui/use-mobile'
import { useVaultFiltering } from '@/hooks/useVaultFiltering'
import { useVaultListData } from '@/hooks/useVaultListData'
import type { TokenAsset } from '@/types/tokenAsset'
import type { Vault } from '@/types/vaultTypes'
import { type FilterRequest, VaultsFilterBar } from './VaultsFilterBar'
import { VaultsMobileList } from './VaultsMobileList'
import { VaultsTable } from './VaultsTable'
import { VaultsTableHeader } from './VaultsTableHeader'

interface VaultsListProps {
  vaults: Vault[]
  tokenAssets: TokenAsset[]
}

export const VaultsList: React.FC<VaultsListProps> = React.memo(({ vaults, tokenAssets }) => {
  const isMobile = useIsMobile()
  const [filterRequest, setFilterRequest] = useState<FilterRequest>()

  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const [availableHeight, setAvailableHeight] = useState(0)
  useLayoutEffect(() => {
    if (!viewport) return
    const measure = () => setAvailableHeight(viewport.clientHeight)
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    measure()
    return () => observer.disconnect()
  }, [viewport])

  // Use our custom hooks for data transformation and filtering
  const vaultListData = useVaultListData(vaults, tokenAssets)
  const filtering = useVaultFiltering(vaultListData)
  const { sortColumn, sortDirection, handleSort, filteredAndSortedVaults } = filtering
  const versions = [...new Set(vaultListData.map((vault) => vault.apiVersion || 'Unknown'))].sort((a, b) =>
    b.localeCompare(a, undefined, { numeric: true })
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Filters Bar */}
      <VaultsFilterBar
        filters={filtering.filters}
        onFiltersChange={filtering.setFilters}
        versions={versions}
        assets={[...new Set(vaultListData.map((vault) => vault.token))].sort()}
        assetIcons={Object.fromEntries(
          vaultListData.filter((vault) => vault.tokenUri).map((vault) => [vault.token, vault.tokenUri])
        )}
        filterRequest={filterRequest}
        searchTerm={filtering.searchTerm}
        onSearchChange={filtering.setSearchTerm}
      />

      {/* Vaults List */}
      {isMobile ? (
        <div ref={setViewport} className="min-h-0 flex-1 overflow-hidden">
          <VaultsMobileList
            vaults={filteredAndSortedVaults}
            availableHeight={availableHeight}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded border bg-white text-sm">
          <VaultsTableHeader
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            onFilter={(type) => setFilterRequest({ type })}
          />
          <div ref={setViewport} className="min-h-0 flex-1 overflow-hidden">
            <VaultsTable vaults={filteredAndSortedVaults} availableHeight={availableHeight} />
          </div>
        </div>
      )}
    </div>
  )
})
