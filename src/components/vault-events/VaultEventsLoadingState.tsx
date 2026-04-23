import React from 'react'
import ChartsLoader from '@/components/charts/ChartsLoader'

interface VaultEventsLoadingStateProps {
  loadingState: string
}

const loadingRowKeys = [
  'events-loading-row-1',
  'events-loading-row-2',
  'events-loading-row-3',
  'events-loading-row-4',
  'events-loading-row-5',
  'events-loading-row-6'
]

export const VaultEventsLoadingState: React.FC<VaultEventsLoadingStateProps> = React.memo(({ loadingState }) => {
  return (
    <div className="px-4 py-4">
      <div className="relative overflow-hidden rounded-lg border border-border bg-white">
        <div className="divide-y divide-border opacity-60">
          {loadingRowKeys.map((rowKey) => (
            <div key={rowKey} className="flex items-center gap-3 px-4 py-3">
              <div className="h-8 w-8 rounded-full border border-border bg-gray-100" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-40 rounded bg-gray-100" />
                <div className="h-3 w-64 max-w-full rounded bg-gray-100" />
              </div>
              <div className="h-3 w-24 rounded bg-gray-100" />
            </div>
          ))}
        </div>

        <ChartsLoader
          loadingState={loadingState}
          overlayClassName="bg-white/75 backdrop-blur-[1px]"
          contentClassName="opacity-100"
        />
      </div>
    </div>
  )
})
