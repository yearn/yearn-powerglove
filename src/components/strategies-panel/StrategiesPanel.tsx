import React, { useState } from 'react'
import { ReallocationChart, ReallocationStrategyTable } from '@/components/reallocation-panel'
import StrategiesSkeleton from '@/components/strategies-panel/StrategiesSkeleton'
import { useIsMobile } from '@/components/ui/use-mobile'
import { useRootDarkMode } from '@/hooks/useRootDarkMode'
import { useSortingAndFiltering } from '@/hooks/useSortingAndFiltering'
import { useStrategiesData } from '@/hooks/useStrategiesData'
import {
  buildComparisonStrategies,
  buildReallocationColorMap,
  buildStateAllocationChartData,
  formatReallocationTimestamp,
  getReallocationPanelLabels
} from '@/lib/reallocation-panels'
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
    const [expandedRows, setExpandedRows] = useState<Set<number>>(() => new Set())
    const [activeMainTab, setActiveMainTab] = useState<string>('Current Strategy Allocations')
    const [showUnallocated, setShowUnallocated] = useState<boolean>(false)
    const [activeReallocationIndex, setActiveReallocationIndex] = useState<number>(0)
    const isMobile = useIsMobile()
    const isDark = useRootDarkMode()
    const hasAbout = Boolean(aboutDescription?.trim())
    const hasReallocation = Boolean(reallocationData)
    const latestReallocationPanelId = reallocationData?.panels.length
      ? reallocationData.panels[reallocationData.panels.length - 1]?.id
      : undefined
    const mainTabs = React.useMemo(() => {
      const list: string[] = ['Current Strategy Allocations']
      if (hasReallocation) list.push('Current Reallocation')
      if (isMobile && hasAbout) list.push('About')
      return list
    }, [hasReallocation, isMobile, hasAbout])

    React.useEffect(() => {
      if (!mainTabs.includes(activeMainTab)) {
        setActiveMainTab('Current Strategy Allocations')
      }
    }, [mainTabs, activeMainTab])

    React.useEffect(() => {
      if (!reallocationData?.panels.length) {
        setActiveReallocationIndex(0)
        return
      }

      if (!latestReallocationPanelId) {
        setActiveReallocationIndex(reallocationData.panels.length - 1)
        return
      }

      setActiveReallocationIndex(reallocationData.panels.length - 1)
    }, [latestReallocationPanelId, reallocationData?.panels.length])

    const activeReallocationPanel = React.useMemo(() => {
      if (!reallocationData?.panels.length) {
        return null
      }

      const nextIndex = Math.min(Math.max(activeReallocationIndex, 0), reallocationData.panels.length - 1)
      return reallocationData.panels[nextIndex] ?? null
    }, [activeReallocationIndex, reallocationData])

    const reallocationPanelLabels = React.useMemo(() => {
      if (!activeReallocationPanel) {
        return {
          beforeLabel: 'Before',
          afterLabel: 'After'
        }
      }

      return getReallocationPanelLabels(activeReallocationPanel)
    }, [activeReallocationPanel])

    const reallocationColorByStrategyKey = React.useMemo(() => {
      if (!reallocationData) {
        return {}
      }

      return buildReallocationColorMap(reallocationData.panels, isDark)
    }, [isDark, reallocationData])

    const activeReallocationStrategies = React.useMemo(() => {
      if (!activeReallocationPanel) {
        return []
      }

      return buildComparisonStrategies(activeReallocationPanel, reallocationColorByStrategyKey)
    }, [activeReallocationPanel, reallocationColorByStrategyKey])

    const activeReallocationAllocationData = React.useMemo(() => {
      if (!activeReallocationPanel) {
        return []
      }

      return buildStateAllocationChartData(activeReallocationPanel.afterState, reallocationColorByStrategyKey)
    }, [activeReallocationPanel, reallocationColorByStrategyKey])

    const toggleRow = (index: number) => {
      setExpandedRows((current) => {
        const next = new Set(current)
        if (next.has(index)) next.delete(index)
        else next.add(index)
        return next
      })
    }

    const renderMainTabContent = () => {
      switch (activeMainTab) {
        case 'Current Strategy Allocations': {
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
            <div className="pb-4 min-[900px]:flex min-[900px]:gap-6">
              {strategiesData.allocationChartData.length > 0 && (
                <div className="hidden min-[900px]:order-2 min-[900px]:flex min-[900px]:basis-1/4 min-[900px]:items-center">
                  <StrategyAllocationChart allocationData={strategiesData.allocationChartData} />
                </div>
              )}

              <div className="w-full min-[900px]:order-1 min-[900px]:min-w-0 min-[900px]:basis-3/4">
                <StrategyTable
                  allocatedStrategies={sortingState.allocatedStrategies}
                  unallocatedStrategies={sortingState.unallocatedStrategies}
                  sortColumn={sortingState.sortColumn}
                  sortDirection={sortingState.sortDirection}
                  onSort={sortingState.handleSort}
                  expandedRows={expandedRows}
                  onToggleRow={toggleRow}
                  showUnallocated={showUnallocated}
                  onToggleUnallocated={() => setShowUnallocated(!showUnallocated)}
                />
              </div>
            </div>
          )
        }
        case 'Current Reallocation': {
          if (!reallocationData || !activeReallocationPanel) return null
          return (
            <div className="space-y-6 px-4 py-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#808080]">
                Recent reallocation timeline
              </div>

              <ReallocationChart
                panels={reallocationData.panels}
                activePanelIndex={activeReallocationIndex}
                onActivePanelIndexChange={setActiveReallocationIndex}
                colorByStrategyKey={reallocationColorByStrategyKey}
              />

              <div className="flex flex-col pb-4 lg:flex-row lg:gap-6">
                <div className="order-2 w-full lg:order-1 lg:basis-3/4">
                  <ReallocationStrategyTable
                    strategies={activeReallocationStrategies}
                    chainId={reallocationData.chainId}
                    beforeLabel={reallocationPanelLabels.beforeLabel}
                    afterLabel={reallocationPanelLabels.afterLabel}
                  />
                </div>

                <div className="order-1 w-full border-b border-border px-4 py-4 lg:order-2 lg:basis-1/4 lg:border-b-0 lg:px-0 lg:py-0">
                  <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#808080]">
                    {reallocationPanelLabels.afterLabel} allocation
                  </div>
                  <div className="text-xs text-[#808080]">
                    {formatReallocationTimestamp(activeReallocationPanel.afterTimestampUtc)}
                  </div>
                  {activeReallocationAllocationData.length > 0 ? (
                    <StrategyAllocationChart allocationData={activeReallocationAllocationData} />
                  ) : (
                    <div className="flex h-[220px] items-center justify-center text-sm text-[#808080]">
                      No allocation summary available for this panel
                    </div>
                  )}
                </div>
              </div>
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
        <div className="mx-auto w-full border-b border-border bg-white">
          <div className="flex items-center overflow-x-auto border-b border-border">
            {mainTabs.map((tab) => (
              <button
                type="button"
                aria-pressed={activeMainTab === tab}
                key={tab}
                className={cn(
                  'shrink-0 whitespace-nowrap border-b-2 border-transparent px-6 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0657f9]',
                  activeMainTab === tab ? 'border-[#0657f9] font-medium text-black' : 'text-[#808080]'
                )}
                onClick={() => setActiveMainTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {renderMainTabContent()}
        </div>
      </div>
    )
  }
)
