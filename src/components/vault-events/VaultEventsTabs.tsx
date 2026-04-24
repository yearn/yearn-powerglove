import React, { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ChainId } from '@/constants/chains'
import { isEnvioConfigured } from '@/lib/envio-client'
import type { VaultExtended } from '@/types/vaultTypes'
import { VaultEventsPanel } from './VaultEventsPanel'
import { VaultManagementEventsPanel } from './VaultManagementEventsPanel'

interface VaultEventsTabsProps {
  vaultChainId: ChainId
  vaultDetails: VaultExtended
}

type VaultEventsTab = 'management' | 'historical'

const tabTriggerClassName =
  'shrink-0 rounded-none border-b-2 border-transparent px-5 py-2.5 text-sm text-muted-foreground data-[state=active]:border-[#0657f9] data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none'

export const VaultEventsTabs: React.FC<VaultEventsTabsProps> = React.memo(({ vaultChainId, vaultDetails }) => {
  const [activeTab, setActiveTab] = useState<VaultEventsTab>('management')
  const [contentMinHeight, setContentMinHeight] = useState<number>(0)
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const hasEventsSource = isEnvioConfigured()

  React.useLayoutEffect(() => {
    const nextHeight = contentRef.current?.offsetHeight ?? 0
    setContentMinHeight((currentHeight) => (nextHeight > currentHeight ? nextHeight : currentHeight))
  })

  if (!hasEventsSource) {
    return (
      <div className="w-full">
        <div className="mx-auto w-full border-y border-border bg-white px-6 py-12 sm:border-x">
          <div className="mx-auto max-w-xl text-center">
            <p className="text-sm text-muted-foreground">
              Vault events require VITE_PUBLIC_ENVIO_GRAPHQL_URL to be configured.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="mx-auto w-full border-y border-border bg-white sm:border-x">
        <Tabs value={activeTab} className="w-full" onValueChange={(value) => setActiveTab(value as VaultEventsTab)}>
          <div className="border-b border-border">
            <div className="px-0 pt-3">
              <TabsList className="flex h-auto w-full justify-start overflow-x-auto bg-transparent p-0">
                <TabsTrigger value="management" className={tabTriggerClassName}>
                  Vault Management Events
                </TabsTrigger>
                <TabsTrigger value="historical" className={tabTriggerClassName}>
                  Historical User Events
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <div ref={contentRef} style={contentMinHeight > 0 ? { minHeight: contentMinHeight } : undefined}>
            <TabsContent value="management" className="mt-0">
              <VaultManagementEventsPanel
                vaultChainId={vaultChainId}
                vaultAddress={vaultDetails.address}
                assetSymbol={vaultDetails.asset?.symbol}
                assetDecimals={vaultDetails.asset?.decimals}
                shareSymbol={vaultDetails.symbol}
                shareDecimals={vaultDetails.decimals ?? vaultDetails.asset?.decimals}
                strategyDetails={vaultDetails.strategyDetails}
              />
            </TabsContent>

            <TabsContent value="historical" className="mt-0">
              <VaultEventsPanel
                vaultChainId={vaultChainId}
                vaultAddress={vaultDetails.address}
                assetSymbol={vaultDetails.asset?.symbol}
                assetDecimals={vaultDetails.asset?.decimals}
                shareSymbol={vaultDetails.symbol}
                shareDecimals={vaultDetails.decimals ?? vaultDetails.asset?.decimals}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
})

VaultEventsTabs.displayName = 'VaultEventsTabs'
