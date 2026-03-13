import React, { useState } from 'react'
import { KongDataTab } from '@/components/strategies-panel/KongDataTab'
import StrategiesSkeleton from '@/components/strategies-panel/StrategiesSkeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSortingAndFiltering } from '@/hooks/useSortingAndFiltering'
import { useStrategiesData } from '@/hooks/useStrategiesData'
import type { KongVaultSnapshot } from '@/types/kong'
import type { VaultExtended } from '@/types/vaultTypes'
import type { ChainId } from '../../constants/chains'
import { StrategyAllocationChart } from './StrategyAllocationChart'
import { StrategyTable } from './StrategyTable'

interface StrategiesPanelProps {
  vaultChainId: ChainId
  vaultDetails: VaultExtended
  kongSnapshot: KongVaultSnapshot | null
}

export const StrategiesPanel: React.FC<StrategiesPanelProps> = React.memo(
  ({ vaultChainId, vaultDetails, kongSnapshot }) => {
    // Extract data logic to custom hooks
    const strategiesData = useStrategiesData(vaultChainId, vaultDetails)
    const sortingState = useSortingAndFiltering(strategiesData.strategies)

    // UI state
    const [expandedRow, setExpandedRow] = useState<number | null>(null)
    const [activeTab, setActiveTab] = useState<'strategies' | 'kong-data'>('strategies')
    const [showUnallocated, setShowUnallocated] = useState<boolean>(false)

    const toggleRow = (index: number) => {
      setExpandedRow(expandedRow === index ? null : index)
    }

    const renderStrategiesContent = () => {
      if (strategiesData.isLoading) {
        return <StrategiesSkeleton />
      }

      if (strategiesData.error) {
        return (
          <div className="flex h-full items-center justify-center px-6 py-20">
            <p className="text-sm text-red-500">{strategiesData.error.message}</p>
          </div>
        )
      }

      if (!sortingState.sortedStrategies || sortingState.sortedStrategies.length === 0) {
        return (
          <div className="flex h-full items-center justify-center px-6 py-20">
            <p className="max-w-xl text-center text-sm text-muted-foreground">
              This vault contains no strategies, and most likely is itself a strategy for an allocator vault.
            </p>
          </div>
        )
      }

      return (
        <div className="flex flex-col pb-4 lg:flex-row">
          <StrategyTable
            allocatedStrategies={sortingState.allocatedStrategies}
            unallocatedStrategies={sortingState.unallocatedStrategies}
            sortColumn={sortingState.sortColumn}
            sortDirection={sortingState.sortDirection}
            onSort={sortingState.handleSort}
            expandedRow={expandedRow}
            onToggleRow={toggleRow}
            showUnallocated={showUnallocated}
            onToggleUnallocated={() => setShowUnallocated(!showUnallocated)}
          />

          <StrategyAllocationChart
            allocationData={strategiesData.allocationChartData}
            apyContributionData={strategiesData.apyContributionChartData}
            totalAPYContribution={strategiesData.totalAPYContribution}
          />
        </div>
      )
    }

    return (
      <div className="w-full">
        <div className="mx-auto w-full border-x border-b border-border bg-white">
          <Tabs value={activeTab} className="w-full" onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
            <div className="border-b border-border">
              <div className="px-0 pt-3">
                <TabsList className="grid h-auto w-fit grid-cols-2 bg-transparent p-0">
                  <TabsTrigger
                    value="strategies"
                    className="rounded-none border-b-2 border-transparent px-5 py-2.5 text-sm text-muted-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Strategies
                  </TabsTrigger>
                  <TabsTrigger
                    value="kong-data"
                    className="rounded-none border-b-2 border-transparent px-5 py-2.5 text-sm text-muted-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Kong Data
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            <TabsContent value="strategies" className="mt-0">
              {renderStrategiesContent()}
            </TabsContent>

            <TabsContent value="kong-data" className="mt-0">
              <KongDataTab snapshot={kongSnapshot} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    )
  }
)
