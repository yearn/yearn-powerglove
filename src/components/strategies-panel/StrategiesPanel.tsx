import React, { useState } from 'react'
import StrategiesSkeleton from '@/components/strategies-panel/StrategiesSkeleton'
import { useSortingAndFiltering } from '@/hooks/useSortingAndFiltering'
import { useStrategiesData } from '@/hooks/useStrategiesData'
import { cn } from '@/lib/utils'
import type { VaultExtended } from '@/types/vaultTypes'
import type { ChainId } from '../../constants/chains'
import { StrategyAllocationChart } from './StrategyAllocationChart'
import { StrategyTable } from './StrategyTable'

interface StrategiesPanelProps {
  vaultChainId: ChainId
  vaultDetails: VaultExtended
}

export const StrategiesPanel: React.FC<StrategiesPanelProps> = React.memo(({ vaultChainId, vaultDetails }) => {
  // Extract data logic to custom hooks
  const strategiesData = useStrategiesData(vaultChainId, vaultDetails)
  const sortingState = useSortingAndFiltering(strategiesData.strategies)

  // UI state
  const [expandedRow, setExpandedRow] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<string>('Strategies')
  const [showUnallocated, setShowUnallocated] = useState<boolean>(false)

  const toggleRow = (index: number) => {
    setExpandedRow(expandedRow === index ? null : index)
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Strategies': {
        if (strategiesData.isLoading) {
          return <StrategiesSkeleton />
        }

        // Add error state handling
        if (strategiesData.error) {
          return (
            <div className="flex justify-center items-center h-full">
              <p className="text-red-500">{strategiesData.error?.message}</p>
            </div>
          )
        }

        // Check if strategies is empty or null
        if (!sortingState.sortedStrategies || sortingState.sortedStrategies.length === 0) {
          return (
            <div className="flex justify-center items-center h-full p-20">
              <p className="text-gray-500 text-center">
                This vault contains no strategies, and most likely is a strategy for an allocator vault.
              </p>
            </div>
          )
        }

        return (
          <div className="flex flex-col pb-4 lg:flex-row lg:gap-6">
            <div className="w-full lg:basis-3/4">
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
            </div>

            {strategiesData.allocationChartData.length > 0 && (
              <div className="w-full lg:basis-1/4">
                <StrategyAllocationChart allocationData={strategiesData.allocationChartData} />
              </div>
            )}
          </div>
        )
      }
      // case 'Info':
      //   return (
      //     <div className="p-8">
      //       <h2 className="text-xl font-semibold mb-4">Info</h2>
      //       <p className="text-[#4f4f4f]">
      //         Additional information and details about the investment strategy.
      //       </p>
      //     </div>
      //   )
      // case 'Risk':
      //   return (
      //     <div className="p-8">
      //       <h2 className="text-xl font-semibold mb-4">Risk</h2>
      //       <p className="text-[#4f4f4f]">
      //         Risk assessment and considerations for this investment strategy.
      //       </p>
      //     </div>
      //   )
      default:
        return null
    }
  }

  return (
    <div className="w-full">
      <div className="w-full mx-auto bg-white border-x border-b border-border">
        {/* Tab Navigation */}
        <div className="flex items-center border-b border-border">
          {/*{['Strategies', 'Info', 'Risk'].map(tab => (*/}
          {['Strategies'].map((tab) => (
            <div
              key={tab}
              className={cn(
                'px-6 py-3 cursor-pointer',
                activeTab === tab ? 'text-black font-medium border-b-2 border-[#0657f9]' : 'text-[#808080]'
              )}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </div>
          ))}
        </div>

        {/* Tab Content */}
        {renderTabContent()}
      </div>
    </div>
  )
})
