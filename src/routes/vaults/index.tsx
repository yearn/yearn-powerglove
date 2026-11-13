import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { VaultsHeadline } from '@/components/landing/native-stats/VaultHeadlineStats'
import YearnLoader from '@/components/utils/YearnLoader'
import { VaultsList } from '@/components/vaults-list'
import { useTokenAssetsContext } from '@/contexts/useTokenAssets'
import { useVaults } from '@/contexts/useVaults'
import type { Vault } from '@/types/vaultTypes'

export default function AllVaultsPage() {
  const pageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      const target = event.target
      if (!(target instanceof Element)) return
      const list = pageRef.current?.querySelector<HTMLElement>('[data-virtual-scroll]')
      if (!list || list.contains(target) || list.scrollHeight <= list.clientHeight) return
      if (target.closest('input, textarea, select, [role="dialog"], [data-radix-popper-content-wrapper]')) return
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? list.clientHeight : 1)
      event.preventDefault()
      list.scrollTop += delta
    }
    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [])
  return (
    <div ref={pageRef} className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
      <div className="shrink-0">
        <VaultsHeadline />
      </div>
      <VaultsContent />
    </div>
  )
}

function VaultsContent() {
  const { vaults, loading, error, loadingState } = useVaults()
  const { assets, loading: assetsLoading, error: assetsError } = useTokenAssetsContext()

  // Ensure data is defined before accessing `data.vaults`
  const retrievedVaults: Vault[] = vaults || []

  // Use enhanced loading state for better UX
  if (loading || assetsLoading) {
    return (
      <div className="min-h-0 flex-1 overflow-auto px-0 py-0 max-w-[1400px] mx-auto w-full">
        <YearnLoader enhancedLoadingState={loadingState} showProgress={true} />
      </div>
    )
  }

  if (error || assetsError) {
    return (
      <div className="min-h-0 flex-1 overflow-auto px-0 py-0 max-w-[1400px] mx-auto w-full">
        <div className="text-red-500">
          Error loading vaults: {error?.message || assetsError?.message || 'Unknown error'}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 container flex-col pt-0 pb-0">
      <div className="flex min-h-0 flex-1 flex-col">
        <VaultsList vaults={retrievedVaults} tokenAssets={assets} />
      </div>
    </div>
  )
}

export const Route = createFileRoute('/vaults/')({
  component: AllVaultsPage
})
