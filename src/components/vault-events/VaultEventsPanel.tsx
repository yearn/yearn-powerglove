import React from 'react'
import type { ChainId } from '@/constants/chains'
import { useVaultEvents } from '@/hooks/useVaultEvents'
import { USER_EVENT_TYPE_OPTIONS } from '@/lib/vault-events'
import { VaultEventRow } from './VaultEventRow'
import { VaultEventsLoadingState } from './VaultEventsLoadingState'
import { VaultEventsPagination } from './VaultEventsPagination'

interface VaultEventsPanelProps {
  vaultChainId: ChainId
  vaultAddress: string
  vaultEventAddresses?: string[]
  assetSymbol?: string
  assetDecimals?: number
  shareSymbol?: string
  shareDecimals?: number
  loadingMinHeight?: number
}

export const VaultEventsPanel: React.FC<VaultEventsPanelProps> = React.memo(
  ({
    vaultChainId,
    vaultAddress,
    vaultEventAddresses,
    assetSymbol,
    assetDecimals,
    shareSymbol,
    shareDecimals,
    loadingMinHeight
  }) => {
    const {
      events,
      totalCount,
      depositCount,
      withdrawCount,
      transferCount,
      isTruncated,
      isLoading,
      error,
      eventType,
      setEventType,
      currentPage,
      setCurrentPage,
      totalPages
    } = useVaultEvents(vaultEventAddresses ?? vaultAddress, vaultChainId)

    if (error) {
      return (
        <div className="flex justify-center items-center py-12">
          <p className="text-red-500 text-sm">Failed to load events: {error.message}</p>
        </div>
      )
    }

    if (isLoading) {
      return <VaultEventsLoadingState loadingState="loading events" minHeight={loadingMinHeight} />
    }

    if (totalCount === 0 && eventType === 'all') {
      return (
        <div className="flex justify-center items-center py-12">
          <p className="text-gray-500 text-sm">No historical events found for this vault.</p>
        </div>
      )
    }

    return (
      <div className="py-4">
        <div className="mb-4 flex flex-col gap-3 px-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4 text-xs text-[#808080]">
            <span>
              <span className="font-semibold text-black">{depositCount}</span> deposits
            </span>
            <span>
              <span className="font-semibold text-black">{withdrawCount}</span> withdrawals
            </span>
            <span>
              <span className="font-semibold text-black">{transferCount}</span> transfers
            </span>
            {isTruncated ? <span className="font-semibold text-amber-700">Recent events only</span> : null}
          </div>
          <div className="flex-1" />
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#808080]">Filter:</label>
              <select
                value={eventType}
                onChange={(e) => {
                  setEventType(e.target.value as typeof eventType)
                  setCurrentPage(1)
                }}
                className="rounded-none border border-border bg-white px-2 py-1 text-xs"
              >
                {USER_EVENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <VaultEventsPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        </div>

        {totalCount === 0 ? (
          <div className="flex justify-center items-center py-8">
            <p className="text-gray-500 text-sm">No events match the selected filter.</p>
          </div>
        ) : (
          <div className="overflow-hidden border-y border-border bg-white">
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
      </div>
    )
  }
)
