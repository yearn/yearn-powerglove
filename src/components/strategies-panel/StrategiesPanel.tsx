import React, { useState } from 'react'
import { ReallocationChart, ReallocationStrategyTable } from '@/components/reallocation-panel'
import StrategiesSkeleton from '@/components/strategies-panel/StrategiesSkeleton'
import { useIsMobile } from '@/components/ui/use-mobile'
import { VaultEventsPanel } from '@/components/vault-events'
import { useSortingAndFiltering } from '@/hooks/useSortingAndFiltering'
import { useStrategiesData } from '@/hooks/useStrategiesData'
import { cn } from '@/lib/utils'
import type { ReallocationData } from '@/types/reallocationTypes'
import type { VaultExtended } from '@/types/vaultTypes'
import type { ChainId } from '../../constants/chains'
import { StrategyAllocationChart } from './StrategyAllocationChart'
import { StrategyTable } from './StrategyTable'

interface StrategiesPanelProps {
  vaultChainId: ChainId
  vaultDetails: VaultExtended
  aboutDescription?: string
  aboutLink?: string
  reallocationData?: ReallocationData | null
}

const ABOUT_TAB_TEXT = `No additional vault description is currently available.`

export const StrategiesPanel: React.FC<StrategiesPanelProps> = React.memo(
  ({ vaultChainId, vaultDetails, aboutDescription, aboutLink, reallocationData }) => {
    // Extract data logic to custom hooks
    const strategiesData = useStrategiesData(vaultChainId, vaultDetails)
    const sortingState = useSortingAndFiltering(strategiesData.strategies)

    // UI state
    const [expandedRow, setExpandedRow] = useState<number | null>(null)
    const [activeTab, setActiveTab] = useState<string>('Current Strategies')
    const [showUnallocated, setShowUnallocated] = useState<boolean>(false)
    const isMobile = useIsMobile()
    const hasAbout = Boolean(aboutDescription?.trim())
    const hasReallocation = Boolean(reallocationData)
    const tabs = React.useMemo(() => {
      const list: string[] = ['Current Strategies']
      list.push('Historical User Events')
      if (hasReallocation) list.push('Current Reallocation')
      if (isMobile && hasAbout) list.push('About')
      return list
    }, [hasReallocation, isMobile, hasAbout])

    React.useEffect(() => {
      if (!tabs.includes(activeTab)) {
        setActiveTab('Current Strategies')
      }
    }, [tabs, activeTab])

    const toggleRow = (index: number) => {
      setExpandedRow(expandedRow === index ? null : index)
    }

    const renderTabContent = () => {
      switch (activeTab) {
        case 'Current Strategies': {
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
              {strategiesData.allocationChartData.length > 0 && (
                <div className="order-1 w-full border-b border-border px-4 py-4 lg:order-2 lg:basis-1/4 lg:border-b-0 lg:px-0 lg:py-0">
                  <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#808080]">
                    Allocation overview
                  </div>
                  <StrategyAllocationChart allocationData={strategiesData.allocationChartData} />
                </div>
              )}

              <div className="order-2 w-full lg:order-1 lg:basis-3/4">
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
            </div>
          )
        }
        case 'Historical User Events': {
          return (
            <VaultEventsPanel
              vaultChainId={vaultChainId}
              vaultAddress={vaultDetails.address}
              tokenSymbol={vaultDetails.asset?.symbol ?? vaultDetails.symbol}
              tokenDecimals={vaultDetails.asset?.decimals}
            />
          )
        }
        case 'Current Reallocation': {
          if (!reallocationData) return null
          return (
            <div className="space-y-4 px-4 py-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#808080]">
                Latest allocation change{reallocationData.timestampUtc ? ` (${reallocationData.timestampUtc})` : ''}
              </div>
              <ReallocationChart strategies={reallocationData.strategies} />
              <ReallocationStrategyTable strategies={reallocationData.strategies} chainId={reallocationData.chainId} />
              {reallocationData.hasUnallocated && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <span className="font-semibold">Warning:</span> {(reallocationData.unallocatedBps / 100).toFixed(2)}%
                  of assets are unallocated.
                </div>
              )}
            </div>
          )
        }
        case 'About': {
          return (
            <div className="flex flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
              <p className="text-sm leading-relaxed text-[#4f4f4f]">{hasAbout ? aboutDescription : ABOUT_TAB_TEXT}</p>
              {!isMobile && aboutLink ? (
                <a
                  className="inline-flex w-fit items-center gap-2 rounded-none bg-[#0657f9] px-4 py-2 text-white hover:bg-[#0657f9]/90"
                  href={aboutLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  Go to Vault
                </a>
              ) : null}
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
        <div className="w-full mx-auto border-b border-border bg-white sm:border-x">
          {/* Tab Navigation */}
          <div className="flex items-center border-b border-border">
            {tabs.map((tab) => (
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
  }
)
