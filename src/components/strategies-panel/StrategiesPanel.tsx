import React, { useState } from 'react'
import { ReallocationChart, ReallocationStrategyTable } from '@/components/reallocation-panel'
import StrategiesSkeleton from '@/components/strategies-panel/StrategiesSkeleton'
import { CHAIN_ID_TO_BLOCK_EXPLORER, type ChainId } from '@/constants/chains'
import { useRootDarkMode } from '@/hooks/useRootDarkMode'
import { useSortingAndFiltering } from '@/hooks/useSortingAndFiltering'
import { useStrategiesData } from '@/hooks/useStrategiesData'
import {
  buildComparisonStrategies,
  buildReallocationColorMap,
  getReallocationPanelLabels
} from '@/lib/reallocation-panels'
import { cn } from '@/lib/utils'
import type { KongVaultSnapshot, KongVaultSnapshotComposition } from '@/types/kong'
import type { ReallocationData } from '@/types/reallocationTypes'
import type { VaultExtended } from '@/types/vaultTypes'
import type { NormalizationContext } from './KongDataTab'
import { StrategyAllocationChart } from './StrategyAllocationChart'
import { StrategyTable } from './StrategyTable'

interface StrategiesPanelProps {
  vaultChainId: ChainId
  vaultDetails: VaultExtended
  kongSnapshot?: KongVaultSnapshot | null
  reallocationData?: ReallocationData | null
}

const parseKongDecimals = (value: unknown): number | null => {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(numeric) && numeric >= 0 && numeric <= 36 ? numeric : null
}

const getCompositionAddress = (composition: KongVaultSnapshotComposition): string | null => {
  return composition.address ?? composition.strategy ?? null
}

export const StrategiesPanel: React.FC<StrategiesPanelProps> = React.memo(
  ({ vaultChainId, vaultDetails, kongSnapshot, reallocationData }) => {
    const strategiesData = useStrategiesData(vaultChainId, vaultDetails)
    const sortingState = useSortingAndFiltering(strategiesData.strategies)

    const [expandedRow, setExpandedRow] = useState<number | null>(null)
    const [showUnallocated, setShowUnallocated] = useState<boolean>(true)
    const [activeReallocationIndex, setActiveReallocationIndex] = useState<number>(0)
    const isDark = useRootDarkMode()
    const hasReallocation = Boolean(reallocationData)
    const latestReallocationPanelId = reallocationData?.panels.length
      ? reallocationData.panels[reallocationData.panels.length - 1]?.id
      : undefined

    const strategyCompositionByAddress = React.useMemo(() => {
      const map = new Map<string, KongVaultSnapshotComposition>()

      for (const composition of kongSnapshot?.composition ?? []) {
        const address = getCompositionAddress(composition)
        if (address) {
          map.set(address.toLowerCase(), composition)
        }
      }

      return map
    }, [kongSnapshot])

    const kongNormalizationContext = React.useMemo<NormalizationContext | null>(() => {
      if (!kongSnapshot) {
        return null
      }

      const assetDecimals = parseKongDecimals(kongSnapshot.asset?.decimals)
      const vaultDecimals = parseKongDecimals(kongSnapshot.decimals) ?? assetDecimals
      const strategyNameByAddress: Record<string, string> = {}

      for (const composition of kongSnapshot.composition ?? []) {
        const address = getCompositionAddress(composition)
        if (address && composition.name?.trim()) {
          strategyNameByAddress[address.toLowerCase()] = composition.name.trim()
        }
      }

      for (const strategy of strategiesData.strategies) {
        strategyNameByAddress[strategy.details.vaultAddress.toLowerCase()] = strategy.name
      }

      return {
        assetDecimals,
        assetSymbol: kongSnapshot.asset?.symbol?.trim() || null,
        blockExplorerBaseUrl: CHAIN_ID_TO_BLOCK_EXPLORER[kongSnapshot.chainId as ChainId]?.replace(/\/+$/, '') ?? null,
        chainId: kongSnapshot.chainId,
        strategyNameByAddress,
        vaultDecimals,
        vaultSymbol: kongSnapshot.symbol?.trim() || null
      }
    }, [kongSnapshot, strategiesData.strategies])

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

          <div
            className={cn(
              'order-2 w-full lg:order-1',
              strategiesData.allocationChartData.length > 0 ? 'lg:basis-3/4' : 'lg:basis-full'
            )}
          >
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
              strategyCompositionByAddress={strategyCompositionByAddress}
              kongNormalizationContext={kongNormalizationContext}
            />
          </div>
        </div>
      )
    }

    const renderReallocationContent = () => {
      if (!reallocationData || !activeReallocationPanel) return null

      return (
        <div className="space-y-6 px-4 py-4">
          <ReallocationChart
            panels={reallocationData.panels}
            activePanelIndex={activeReallocationIndex}
            onActivePanelIndexChange={setActiveReallocationIndex}
            colorByStrategyKey={reallocationColorByStrategyKey}
          />

          <div className="pb-4">
            <ReallocationStrategyTable
              strategies={activeReallocationStrategies}
              chainId={reallocationData.chainId}
              beforeLabel={reallocationPanelLabels.beforeLabel}
              afterLabel={reallocationPanelLabels.afterLabel}
            />
          </div>
        </div>
      )
    }

    return (
      <div className="w-full">
        <div className="mx-auto w-full border-y border-border bg-white sm:border-x">
          <section>
            <div className="border-b border-border px-4 py-3 sm:px-6">
              <h2 className="text-base font-semibold text-[#111111]">Current Strategies</h2>
            </div>
            {renderStrategiesContent()}
          </section>

          {hasReallocation ? (
            <section className="border-t border-border">
              <div className="border-b border-border px-4 py-3 sm:px-6">
                <h2 className="text-base font-semibold text-[#111111]">Strategy Reallocation History</h2>
              </div>
              {renderReallocationContent()}
            </section>
          ) : null}
        </div>
      </div>
    )
  }
)
