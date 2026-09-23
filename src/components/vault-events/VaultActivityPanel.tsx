import React, { useState } from 'react'
import type { ChainId } from '@/constants/chains'
import { getVaultEventAddresses } from '@/constants/featuredVaults'
import { isEnvioConfigured } from '@/lib/envio-client'
import { cn } from '@/lib/utils'
import type { VaultExtended } from '@/types/vaultTypes'
import { VaultEventsPanel } from './VaultEventsPanel'
import { VaultManagementEventsPanel } from './VaultManagementEventsPanel'

type VaultActivityPanelProps = {
  vaultChainId: ChainId
  vaultDetails: VaultExtended
  maxHeight?: number
}

const activityTabs = ['Vault Management Events', 'Historical User Events'] as const
type ActivityTab = (typeof activityTabs)[number]

export function VaultActivityPanel({ vaultChainId, vaultDetails, maxHeight }: VaultActivityPanelProps) {
  const [activeTab, setActiveTab] = useState<ActivityTab>('Vault Management Events')
  const [contentMinHeight, setContentMinHeight] = useState(0)
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const vaultEventAddresses = React.useMemo(
    () => getVaultEventAddresses(vaultChainId, vaultDetails.address),
    [vaultChainId, vaultDetails.address]
  )

  React.useLayoutEffect(() => {
    if (maxHeight !== undefined) return

    const nextHeight = contentRef.current?.offsetHeight ?? 0
    if (nextHeight > contentMinHeight) {
      setContentMinHeight(nextHeight)
    }
  }, [contentMinHeight, maxHeight])

  if (!isEnvioConfigured()) return null

  const sharedPanelProps = {
    vaultChainId,
    vaultAddress: vaultDetails.address,
    vaultEventAddresses,
    assetSymbol: vaultDetails.asset?.symbol,
    assetDecimals: vaultDetails.asset?.decimals,
    shareSymbol: vaultDetails.symbol,
    shareDecimals: vaultDetails.decimals ?? vaultDetails.asset?.decimals
  }

  return (
    <div className="w-full border-b border-border bg-white sm:border-x">
      <div
        className="flex items-center overflow-x-auto border-b border-border"
        role="tablist"
        aria-label="Vault activity views"
      >
        {activityTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={cn(
              'shrink-0 whitespace-nowrap border-b-2 border-transparent px-6 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0657f9]',
              activeTab === tab ? 'border-[#0657f9] font-medium text-black' : 'text-[#808080] hover:text-[#4f4f4f]'
            )}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div
        ref={contentRef}
        className={cn(maxHeight !== undefined && 'overflow-y-auto overscroll-contain')}
        style={
          maxHeight !== undefined ? { maxHeight } : contentMinHeight > 0 ? { minHeight: contentMinHeight } : undefined
        }
        data-testid={maxHeight !== undefined ? 'vault-activity-scroll' : undefined}
      >
        {activeTab === 'Vault Management Events' ? (
          <VaultManagementEventsPanel {...sharedPanelProps} strategyDetails={vaultDetails.strategyDetails} />
        ) : (
          <VaultEventsPanel {...sharedPanelProps} />
        )}
      </div>
    </div>
  )
}
