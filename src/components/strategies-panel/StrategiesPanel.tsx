import React, { useState } from 'react'
import { ReallocationChart, ReallocationStrategyTable } from '@/components/reallocation-panel'
import StrategiesSkeleton from '@/components/strategies-panel/StrategiesSkeleton'
import { useIsMobile } from '@/components/ui/use-mobile'
import { VaultEventsPanel, VaultManagementEventsPanel } from '@/components/vault-events'
import { useRootDarkMode } from '@/hooks/useRootDarkMode'
import { useSortingAndFiltering } from '@/hooks/useSortingAndFiltering'
import { useStrategiesData } from '@/hooks/useStrategiesData'
import { isEnvioConfigured } from '@/lib/envio-client'
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
    const [expandedRow, setExpandedRow] = useState<number | null>(null)
    const [activeMainTab, setActiveMainTab] = useState<string>('Current Strategies')
    const [activeEventsTab, setActiveEventsTab] = useState<string>('Vault Management Events')
    const [showUnallocated, setShowUnallocated] = useState<boolean>(false)
    const [activeReallocationIndex, setActiveReallocationIndex] = useState<number>(0)
    const [eventsContentMinHeight, setEventsContentMinHeight] = useState<number>(0)
    const isMobile = useIsMobile()
    const isDark = useRootDarkMode()
    const eventsContentRef = React.useRef<HTMLDivElement | null>(null)
    const hasAbout = Boolean(aboutDescription?.trim())
    const hasReallocation = Boolean(reallocationData)
    const hasHistoricalUserEvents = isEnvioConfigured()
    const hasVaultManagementEvents = isEnvioConfigured()
    const latestReallocationPanelId = reallocationData?.panels.length
      ? reallocationData.panels[reallocationData.panels.length - 1]?.id
      : undefined
    const mainTabs = React.useMemo(() => {
      const list: string[] = ['Current Strategies']
      if (hasReallocation) list.push('Current Reallocation')
      if (isMobile && hasAbout) list.push('About')
      return list
    }, [hasReallocation, isMobile, hasAbout])

    const eventTabs = React.useMemo(() => {
      const list: string[] = []
      if (hasVaultManagementEvents) list.push('Vault Management Events')
      if (hasHistoricalUserEvents) list.push('Historical User Events')
      return list
    }, [hasHistoricalUserEvents, hasVaultManagementEvents])

    React.useEffect(() => {
      if (!mainTabs.includes(activeMainTab)) {
        setActiveMainTab('Current Strategies')
      }
    }, [mainTabs, activeMainTab])

    React.useEffect(() => {
      if (eventTabs.length === 0) {
        return
      }

      if (!eventTabs.includes(activeEventsTab)) {
        setActiveEventsTab(eventTabs[0] ?? 'Vault Management Events')
      }
    }, [eventTabs, activeEventsTab])

    React.useLayoutEffect(() => {
      const nextHeight = eventsContentRef.current?.offsetHeight ?? 0
      if (nextHeight > eventsContentMinHeight) {
        setEventsContentMinHeight(nextHeight)
      }
    })

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
      setExpandedRow(expandedRow === index ? null : index)
    }

    const renderMainTabContent = () => {
      switch (activeMainTab) {
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

    const renderEventsTabContent = () => {
      switch (activeEventsTab) {
        case 'Vault Management Events':
          return (
            <VaultManagementEventsPanel
              vaultChainId={vaultChainId}
              vaultAddress={vaultDetails.address}
              assetSymbol={vaultDetails.asset?.symbol}
              assetDecimals={vaultDetails.asset?.decimals}
              shareSymbol={vaultDetails.symbol}
              shareDecimals={vaultDetails.decimals ?? vaultDetails.asset?.decimals}
              strategyDetails={vaultDetails.strategyDetails}
            />
          )
        case 'Historical User Events':
          return (
            <VaultEventsPanel
              vaultChainId={vaultChainId}
              vaultAddress={vaultDetails.address}
              assetSymbol={vaultDetails.asset?.symbol}
              assetDecimals={vaultDetails.asset?.decimals}
              shareSymbol={vaultDetails.symbol}
              shareDecimals={vaultDetails.decimals ?? vaultDetails.asset?.decimals}
            />
          )
        default:
          return null
      }
    }

    return (
      <div className="w-full">
        <div className="w-full mx-auto border-b border-border bg-white sm:border-x">
          <div className="flex items-center border-b border-border">
            {mainTabs.map((tab) => (
              <div
                key={tab}
                className={cn(
                  'px-6 py-3 cursor-pointer',
                  activeMainTab === tab ? 'text-black font-medium border-b-2 border-[#0657f9]' : 'text-[#808080]'
                )}
                onClick={() => setActiveMainTab(tab)}
              >
                {tab}
              </div>
            ))}
          </div>

          {renderMainTabContent()}
          {eventTabs.length > 0 ? (
            <div className="border-t border-border">
              <div className="flex items-center border-b border-border">
                {eventTabs.map((tab) => (
                  <div
                    key={tab}
                    className={cn(
                      'px-6 py-3 cursor-pointer',
                      activeEventsTab === tab ? 'text-black font-medium border-b-2 border-[#0657f9]' : 'text-[#808080]'
                    )}
                    onClick={() => setActiveEventsTab(tab)}
                  >
                    {tab}
                  </div>
                ))}
              </div>

              <div
                ref={eventsContentRef}
                style={eventsContentMinHeight > 0 ? { minHeight: eventsContentMinHeight } : undefined}
              >
                {renderEventsTabContent()}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    )
  }
)
