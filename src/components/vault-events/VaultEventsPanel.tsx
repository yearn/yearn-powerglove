import React from 'react'
import type { ChainId } from '@/constants/chains'
import { useVaultEvents } from '@/hooks/useVaultEvents'
import { USER_EVENT_TYPE_OPTIONS } from '@/lib/vault-events'
import { VaultEventRow } from './VaultEventRow'
import { VaultEventsLoadingState } from './VaultEventsLoadingState'

interface VaultEventsPanelProps {
  vaultChainId: ChainId
  vaultAddress: string
  assetSymbol?: string
  assetDecimals?: number
  shareSymbol?: string
  shareDecimals?: number
}

export const VaultEventsPanel: React.FC<VaultEventsPanelProps> = React.memo(
  ({ vaultChainId, vaultAddress, assetSymbol, assetDecimals, shareSymbol, shareDecimals }) => {
    const {
      events,
      totalCount,
      depositCount,
      withdrawCount,
      transferCount,
      pendingEventTypes,
      isLoading,
      isLoadingMore,
      hasMoreEvents,
      error,
      loadMoreEvents,
      eventType,
      setEventType,
      currentPage,
      setCurrentPage,
      totalPages
    } = useVaultEvents(vaultAddress, vaultChainId)

    const pendingEventTypeLabels = React.useMemo(
      () =>
        USER_EVENT_TYPE_OPTIONS.filter(
          (option) => option.value !== 'all' && pendingEventTypes.includes(option.value)
        ).map((option) => option.label),
      [pendingEventTypes]
    )

    const handleNextPage = React.useCallback(async () => {
      if (currentPage < totalPages) {
        setCurrentPage((page) => Math.min(totalPages, page + 1))
        return
      }

      if (!hasMoreEvents) {
        return
      }

      const loadedCount = await loadMoreEvents()
      if (loadedCount > 0) {
        setCurrentPage((page) => page + 1)
      }
    }, [currentPage, hasMoreEvents, loadMoreEvents, setCurrentPage, totalPages])

    const showPaginationControls = totalPages > 1 || hasMoreEvents

    const renderPaginationControls = () => (
      <div className="flex items-center gap-1 text-xs text-[#808080]">
        <span className="whitespace-nowrap">
          Page {currentPage} of {totalPages}
          {hasMoreEvents ? '+' : ''}
        </span>
        <button
          type="button"
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1 || isLoadingMore}
          className="rounded border border-border px-2 py-1 disabled:opacity-50 hover:bg-gray-50"
        >
          First
        </button>
        <button
          type="button"
          onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
          disabled={currentPage === 1 || isLoadingMore}
          className="rounded border border-border px-2 py-1 disabled:opacity-50 hover:bg-gray-50"
        >
          Prev
        </button>
        <button
          type="button"
          onClick={handleNextPage}
          disabled={isLoadingMore || (currentPage === totalPages && !hasMoreEvents)}
          className="rounded border border-border px-2 py-1 disabled:opacity-50 hover:bg-gray-50"
        >
          {isLoadingMore && currentPage === totalPages ? 'Loading...' : 'Next'}
        </button>
        {hasMoreEvents ? (
          <button
            type="button"
            onClick={() => void loadMoreEvents()}
            disabled={isLoadingMore}
            className="rounded border border-border px-2 py-1 disabled:opacity-50 hover:bg-gray-50"
          >
            {isLoadingMore ? 'Loading...' : 'Load more'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages || isLoadingMore}
            className="rounded border border-border px-2 py-1 disabled:opacity-50 hover:bg-gray-50"
          >
            Last
          </button>
        )}
      </div>
    )

    if (error) {
      return (
        <div className="flex justify-center items-center py-12">
          <p className="text-red-500 text-sm">Failed to load events: {error.message}</p>
        </div>
      )
    }

    if (isLoading) {
      return <VaultEventsLoadingState loadingState="loading events" />
    }

    if (totalCount === 0 && eventType === 'all') {
      return (
        <div className="flex justify-center items-center py-12">
          <p className="text-gray-500 text-sm">No historical events found for this vault.</p>
        </div>
      )
    }

    return (
      <div className="px-4 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="flex items-center gap-4 text-xs text-[#808080]">
            <span>
              <span className="font-semibold text-black">{depositCount}</span> deposits loaded
            </span>
            <span>
              <span className="font-semibold text-black">{withdrawCount}</span> withdrawals loaded
            </span>
            <span>
              <span className="font-semibold text-black">{transferCount}</span> transfers loaded
            </span>
            {hasMoreEvents ? <span>More events available</span> : null}
            {pendingEventTypeLabels.length > 0 ? <span>Loading {pendingEventTypeLabels.join(', ')}</span> : null}
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
                className="text-xs border border-border rounded px-2 py-1 bg-white"
              >
                {USER_EVENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {showPaginationControls ? renderPaginationControls() : null}
          </div>
        </div>

        {totalCount === 0 ? (
          <div className="flex justify-center items-center py-8">
            <p className="text-gray-500 text-sm">No events match the selected filter.</p>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden bg-white">
            {events.map((event) => (
              <VaultEventRow
                key={event.id}
                event={event}
                assetSymbol={assetSymbol}
                assetDecimals={assetDecimals}
                shareSymbol={shareSymbol}
                shareDecimals={shareDecimals}
              />
            ))}
          </div>
        )}

        {showPaginationControls && (
          <div className="flex items-center justify-between mt-3 text-xs text-[#808080]">
            <span />
            {renderPaginationControls()}
          </div>
        )}
      </div>
    )
  }
)
