import { useQuery } from '@tanstack/react-query'
import React from 'react'
import type { ChainId } from '@/constants/chains'
import { useVaultManagementEvents } from '@/hooks/useVaultManagementEvents'
import { fetchStrategyDisplayNames } from '@/lib/kong-strategy-names'
import { fetchVaultUserEventsForTransactions } from '@/lib/vault-events'
import { buildVaultManagementTimelineItems } from '@/lib/vault-management-display'
import type { VaultDerivedStrategy } from '@/types/vaultTypes'
import { VaultDebtReallocationRow } from './VaultDebtReallocationRow'
import { VaultDebtSequenceRow } from './VaultDebtSequenceRow'
import { VaultEventRow } from './VaultEventRow'
import { VaultEventsLoadingState } from './VaultEventsLoadingState'

interface VaultManagementEventsPanelProps {
  vaultChainId: ChainId
  vaultAddress: string
  assetSymbol?: string
  assetDecimals?: number
  shareSymbol?: string
  shareDecimals?: number
  strategyDetails?: VaultDerivedStrategy[]
}

const PAGE_SIZE = 50

export const VaultManagementEventsPanel: React.FC<VaultManagementEventsPanelProps> = React.memo(
  ({ vaultChainId, vaultAddress, assetSymbol, assetDecimals, shareSymbol, shareDecimals, strategyDetails = [] }) => {
    const {
      allEvents,
      allEventCount,
      countsByType,
      availableEventTypeOptions,
      isLoading,
      isLoadingMore: isManagementEventsLoadingMore,
      hasMoreEvents: hasMoreManagementEvents,
      error,
      loadMoreEvents: loadMoreManagementEvents,
      eventType,
      setEventType,
      currentPage,
      setCurrentPage
    } = useVaultManagementEvents(vaultAddress, vaultChainId)

    const baseStrategyNamesByAddress = React.useMemo(() => {
      const byAddress: Record<string, string> = {}

      for (const strategy of strategyDetails) {
        const normalizedAddress = strategy.address?.toLowerCase()
        const normalizedName = strategy.name?.trim()
        if (!normalizedAddress || !normalizedName) {
          continue
        }

        byAddress[normalizedAddress] = normalizedName
      }

      return byAddress
    }, [strategyDetails])

    const unresolvedStrategyAddresses = React.useMemo(() => {
      const addresses = new Set<string>()

      for (const event of allEvents) {
        if (event.strategy) {
          const normalizedStrategyAddress = event.strategy.toLowerCase()
          if (!baseStrategyNamesByAddress[normalizedStrategyAddress]) {
            addresses.add(normalizedStrategyAddress)
          }
        }

        for (const queueAddress of event.newDefaultQueue ?? []) {
          const normalizedQueueAddress = queueAddress.toLowerCase()
          if (!baseStrategyNamesByAddress[normalizedQueueAddress]) {
            addresses.add(normalizedQueueAddress)
          }
        }
      }

      return [...addresses].sort()
    }, [allEvents, baseStrategyNamesByAddress])

    const { data: fetchedStrategyNamesByAddress } = useQuery({
      queryKey: ['kong', 'management-event-strategy-names', vaultChainId, unresolvedStrategyAddresses],
      queryFn: () => fetchStrategyDisplayNames(vaultChainId, unresolvedStrategyAddresses),
      enabled: unresolvedStrategyAddresses.length > 0,
      staleTime: 5 * 60 * 1000
    })

    const strategyNamesByAddress = React.useMemo(() => {
      const merged: Record<string, string> = { ...baseStrategyNamesByAddress }

      for (const [address, info] of Object.entries(fetchedStrategyNamesByAddress ?? {})) {
        if (info?.name) {
          merged[address.toLowerCase()] = info.name
        }
      }

      return merged
    }, [baseStrategyNamesByAddress, fetchedStrategyNamesByAddress])

    const managementTransactionHashes = React.useMemo(() => {
      const transactionHashesByKey = new Map<string, string>()

      for (const event of allEvents) {
        if (event.transactionHash) {
          transactionHashesByKey.set(event.transactionHash.toLowerCase(), event.transactionHash)
        }
      }

      return [...transactionHashesByKey.values()].sort()
    }, [allEvents])

    const managementTransactionHashKey = managementTransactionHashes.join(',')

    const {
      data: userEvents = [],
      error: userEventsError,
      isFetching: isUserEventContextFetching
    } = useQuery({
      queryKey: [
        'envio',
        'vault-management-user-event-context',
        vaultChainId,
        vaultAddress.toLowerCase(),
        managementTransactionHashKey
      ],
      queryFn: () => fetchVaultUserEventsForTransactions(vaultAddress, vaultChainId, managementTransactionHashes),
      enabled: managementTransactionHashes.length > 0,
      staleTime: 60 * 1000
    })

    const isUserEventContextLoading = managementTransactionHashes.length > 0 && isUserEventContextFetching
    const isTimelineLoading = isLoading || isUserEventContextLoading
    const isTimelineLoadingMore = isManagementEventsLoadingMore
    const hasMoreTimelineItems = hasMoreManagementEvents

    const timelineItems = React.useMemo(() => {
      if (isTimelineLoading) {
        return []
      }

      return buildVaultManagementTimelineItems(allEvents, userEvents, eventType)
    }, [allEvents, userEvents, eventType, isTimelineLoading])

    const totalPages = Math.max(1, Math.ceil(timelineItems.length / PAGE_SIZE))

    React.useEffect(() => {
      setCurrentPage((page) => Math.min(page, totalPages))
    }, [setCurrentPage, totalPages])

    const paginatedTimelineItems = React.useMemo(
      () => timelineItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
      [currentPage, timelineItems]
    )

    const loadMoreTimelineItems = React.useCallback(async () => {
      if (!hasMoreManagementEvents) {
        return 0
      }

      return loadMoreManagementEvents()
    }, [hasMoreManagementEvents, loadMoreManagementEvents])

    const handleNextPage = React.useCallback(async () => {
      if (currentPage < totalPages) {
        setCurrentPage((page) => Math.min(totalPages, page + 1))
        return
      }

      if (!hasMoreTimelineItems) {
        return
      }

      const loadedCount = await loadMoreTimelineItems()
      if (loadedCount > 0) {
        setCurrentPage((page) => page + 1)
      }
    }, [currentPage, hasMoreTimelineItems, loadMoreTimelineItems, setCurrentPage, totalPages])

    const showPaginationControls = totalPages > 1 || hasMoreTimelineItems

    const renderPaginationControls = () => (
      <div className="flex items-center gap-1 text-xs text-[#808080]">
        <span className="whitespace-nowrap">
          Page {currentPage} of {totalPages}
          {hasMoreTimelineItems ? '+' : ''}
        </span>
        <button
          type="button"
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1 || isTimelineLoadingMore}
          className="rounded border border-border px-2 py-1 disabled:opacity-50 hover:bg-gray-50"
        >
          First
        </button>
        <button
          type="button"
          onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
          disabled={currentPage === 1 || isTimelineLoadingMore}
          className="rounded border border-border px-2 py-1 disabled:opacity-50 hover:bg-gray-50"
        >
          Prev
        </button>
        <button
          type="button"
          onClick={handleNextPage}
          disabled={isTimelineLoadingMore || (currentPage === totalPages && !hasMoreTimelineItems)}
          className="rounded border border-border px-2 py-1 disabled:opacity-50 hover:bg-gray-50"
        >
          {isTimelineLoadingMore && currentPage === totalPages ? 'Loading...' : 'Next'}
        </button>
        {hasMoreTimelineItems ? (
          <button
            type="button"
            onClick={() => void loadMoreTimelineItems()}
            disabled={isTimelineLoadingMore}
            className="rounded border border-border px-2 py-1 disabled:opacity-50 hover:bg-gray-50"
          >
            {isTimelineLoadingMore ? 'Loading...' : 'Load more'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages || isTimelineLoadingMore}
            className="rounded border border-border px-2 py-1 disabled:opacity-50 hover:bg-gray-50"
          >
            Last
          </button>
        )}
      </div>
    )

    const hasUserEventContextError = Boolean(userEventsError)
    const resolvedError = error

    if (resolvedError) {
      return (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-red-500">Failed to load management events: {resolvedError.message}</p>
        </div>
      )
    }

    if (isTimelineLoading) {
      return <VaultEventsLoadingState loadingState={isLoading ? 'loading management events' : 'combining event rows'} />
    }

    if (allEventCount === 0 && eventType === 'all') {
      return (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-gray-500">No vault management events found for this vault.</p>
        </div>
      )
    }

    const rawFilteredCount = eventType === 'all' ? allEventCount : (countsByType.get(eventType) ?? 0)
    const activeTypeCount = timelineItems.length

    return (
      <div className="px-4 py-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-4 text-xs text-[#808080]">
            <span>
              <span className="font-semibold text-black">{allEventCount}</span> management events loaded
            </span>
            {rawFilteredCount !== activeTypeCount ? (
              <span>
                <span className="font-semibold text-black">{activeTypeCount}</span> loaded timeline entries after
                grouping
              </span>
            ) : null}
            {eventType !== 'all' ? (
              <span>
                <span className="font-semibold text-black">{activeTypeCount}</span> loaded entries matching current
                filter
              </span>
            ) : null}
            {hasMoreTimelineItems ? <span>More events available</span> : null}
            {hasUserEventContextError ? <span>User-event context unavailable</span> : null}
          </div>
          <div className="flex-1" />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#808080]">Filter:</label>
              <select
                value={eventType}
                onChange={(e) => {
                  setEventType(e.target.value as typeof eventType)
                  setCurrentPage(1)
                }}
                className="rounded border border-border bg-white px-2 py-1 text-xs"
              >
                {availableEventTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {showPaginationControls ? renderPaginationControls() : null}
          </div>
        </div>

        {timelineItems.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-gray-500">No management events match the selected filter.</p>
          </div>
        ) : (
          <div className="overflow-hidden bg-white">
            {paginatedTimelineItems.map((item) =>
              item.kind === 'reallocation' ? (
                <VaultDebtReallocationRow
                  key={item.id}
                  item={item}
                  assetSymbol={assetSymbol}
                  assetDecimals={assetDecimals}
                  strategyNamesByAddress={strategyNamesByAddress}
                />
              ) : item.kind === 'sequence' ? (
                <VaultDebtSequenceRow
                  key={item.id}
                  item={item}
                  assetSymbol={assetSymbol}
                  assetDecimals={assetDecimals}
                  strategyNamesByAddress={strategyNamesByAddress}
                />
              ) : (
                <VaultEventRow
                  key={item.id}
                  event={item.event}
                  assetSymbol={assetSymbol}
                  assetDecimals={assetDecimals}
                  shareSymbol={shareSymbol}
                  shareDecimals={shareDecimals}
                  strategyNamesByAddress={strategyNamesByAddress}
                  reason={item.reason}
                />
              )
            )}
          </div>
        )}

        {showPaginationControls ? (
          <div className="mt-3 flex items-center justify-between text-xs text-[#808080]">
            <span />
            {renderPaginationControls()}
          </div>
        ) : null}
      </div>
    )
  }
)
