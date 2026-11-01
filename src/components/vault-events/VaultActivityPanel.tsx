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
  maxHeight?: number | string
  snapToRows?: boolean
}

const activityTabs = ['Vault Management Events', 'Historical User Events'] as const
type ActivityTab = (typeof activityTabs)[number]

export function VaultActivityPanel({
  vaultChainId,
  vaultDetails,
  maxHeight,
  snapToRows = false
}: VaultActivityPanelProps) {
  const [activeTab, setActiveTab] = useState<ActivityTab>('Vault Management Events')
  const [contentMinHeight, setContentMinHeight] = useState(0)
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const heightBudgetRef = React.useRef<HTMLDivElement | null>(null)
  const [rowHeight, setRowHeight] = useState<number>()
  const vaultEventAddresses = React.useMemo(
    () => getVaultEventAddresses(vaultChainId, vaultDetails.address),
    [vaultChainId, vaultDetails.address]
  )

  React.useLayoutEffect(() => {
    const content = contentRef.current
    if (maxHeight !== undefined || !content) return

    const updateHeight = () => setContentMinHeight((height) => Math.max(height, content.offsetHeight))
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(content)
    return () => observer.disconnect()
  }, [maxHeight])

  React.useLayoutEffect(() => {
    const content = contentRef.current
    if (!content || maxHeight === undefined || !snapToRows) return
    let frame = 0
    const resize = new ResizeObserver(() => scheduleMeasure())
    let observedChild: Element | null = null
    resize.observe(content)
    if (heightBudgetRef.current) resize.observe(heightBudgetRef.current)
    const measure = () => {
      frame = 0
      if (content.firstElementChild !== observedChild) {
        if (observedChild) resize.unobserve(observedChild)
        observedChild = content.firstElementChild
        if (observedChild) resize.observe(observedChild)
      }
      const rows = [...content.querySelectorAll<HTMLElement>('[data-vault-activity-rows] > *')]
      const ceiling = heightBudgetRef.current?.getBoundingClientRect().height ?? 0
      if (
        !rows.length ||
        !Number.isFinite(ceiling) ||
        content.firstElementChild!.getBoundingClientRect().height <= ceiling
      ) {
        setRowHeight(undefined)
        return
      }
      const top = content.getBoundingClientRect().top - content.scrollTop
      // Row heights vary with wrapping and expanded details, so use actual row boundaries.
      let visibleRows = 0
      for (const row of rows) {
        const bottom = row.getBoundingClientRect().bottom - top
        if (bottom > ceiling) break
        visibleRows++
      }
      const lastVisibleRow = rows[Math.min(visibleRows + 2, rows.length) - 1]
      setRowHeight(lastVisibleRow.getBoundingClientRect().bottom - top)
    }
    function scheduleMeasure() {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    const mutations = new MutationObserver(scheduleMeasure)
    mutations.observe(content, { childList: true, subtree: true })
    window.addEventListener('resize', scheduleMeasure)
    measure()
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      mutations.disconnect()
      window.removeEventListener('resize', scheduleMeasure)
    }
  }, [maxHeight, snapToRows])

  if (!isEnvioConfigured()) return null

  const sharedPanelProps = {
    vaultChainId,
    vaultAddress: vaultDetails.address,
    vaultEventAddresses,
    assetSymbol: vaultDetails.asset?.symbol,
    assetDecimals: vaultDetails.asset?.decimals,
    shareSymbol: vaultDetails.symbol,
    shareDecimals: vaultDetails.decimals ?? vaultDetails.asset?.decimals,
    loadingMinHeight: typeof maxHeight === 'number' ? maxHeight : undefined
  }

  return (
    <div className={cn('w-full bg-white', snapToRows && 'pb-4')}>
      {snapToRows && maxHeight !== undefined && (
        <div
          ref={heightBudgetRef}
          aria-hidden="true"
          className="pointer-events-none invisible absolute w-0"
          style={{ height: maxHeight }}
        />
      )}
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
          maxHeight !== undefined
            ? {
                maxHeight: snapToRows && rowHeight !== undefined ? rowHeight : maxHeight,
                height: snapToRows ? rowHeight : undefined
              }
            : contentMinHeight > 0
              ? { minHeight: contentMinHeight }
              : undefined
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
