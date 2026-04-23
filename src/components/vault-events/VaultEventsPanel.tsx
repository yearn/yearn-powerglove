import React from 'react'
import type { ChainId } from '@/constants/chains'
import { useVaultEvents } from '@/hooks/useVaultEvents'
import { VaultEventRow } from './VaultEventRow'

interface VaultEventsPanelProps {
  vaultChainId: ChainId
  vaultAddress: string
  assetSymbol?: string
  assetDecimals?: number
  shareSymbol?: string
  shareDecimals?: number
}

const EVENT_TYPE_OPTIONS = [
  { value: 'all', label: 'All events' },
  { value: 'deposit', label: 'Deposits' },
  { value: 'withdraw', label: 'Withdrawals' },
  { value: 'transfer', label: 'Transfers' }
]

export const VaultEventsPanel: React.FC<VaultEventsPanelProps> = React.memo(
  ({ vaultChainId, vaultAddress, assetSymbol, assetDecimals, shareSymbol, shareDecimals }) => {
    const {
      events,
      totalCount,
      depositCount,
      withdrawCount,
      transferCount,
      isLoading,
      error,
      eventType,
      setEventType,
      currentPage,
      setCurrentPage,
      totalPages
    } = useVaultEvents(vaultAddress, vaultChainId)

    if (error) {
      return (
        <div className="flex justify-center items-center py-12">
          <p className="text-red-500 text-sm">Failed to load events: {error.message}</p>
        </div>
      )
    }

    if (isLoading) {
      return (
        <div className="space-y-3 px-4 py-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 rounded bg-gray-200" />
                <div className="h-3 w-32 rounded bg-gray-200" />
              </div>
              <div className="h-3 w-20 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      )
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
              <span className="font-semibold text-black">{depositCount}</span> deposits
            </span>
            <span>
              <span className="font-semibold text-black">{withdrawCount}</span> withdrawals
            </span>
            <span>
              <span className="font-semibold text-black">{transferCount}</span> transfers
            </span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#808080]">Filter:</label>
            <select
              value={eventType}
              onChange={(e) => {
                setEventType(e.target.value)
                setCurrentPage(1)
              }}
              className="text-xs border border-border rounded px-2 py-1 bg-white"
            >
              {EVENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3 text-xs text-[#808080]">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 border border-border rounded disabled:opacity-50 hover:bg-gray-50"
              >
                First
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 border border-border rounded disabled:opacity-50 hover:bg-gray-50"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 border border-border rounded disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 border border-border rounded disabled:opacity-50 hover:bg-gray-50"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }
)
