import { createFileRoute } from '@tanstack/react-router'
import YearnLoader from '@/components/utils/YearnLoader'
import { VaultsList } from '@/components/vaults-list'
import { useTokenAssetsContext } from '@/contexts/useTokenAssets'
import { useVaults } from '@/contexts/useVaults'
import type { Vault } from '@/types/vaultTypes'

export default function AllVaultsPage() {
  const { vaults, loading, error, loadingState } = useVaults()
  const { assets, loading: assetsLoading, error: assetsError } = useTokenAssetsContext()

  // Ensure data is defined before accessing `data.vaults`
  const retrievedVaults: Vault[] = vaults || []

  // Use enhanced loading state for better UX
  if (loading || assetsLoading) {
    return (
      <div className="min-h-screen px-0 py-0 max-w-[1400px] mx-auto w-full">
        <YearnLoader enhancedLoadingState={loadingState} showProgress={true} />
      </div>
    )
  }

  if (error || assetsError) {
    return (
      <div className="min-h-screen px-0 py-0 max-w-[1400px] mx-auto w-full">
        <div className="text-red-500">
          Error loading vaults: {error?.message || assetsError?.message || 'Unknown error'}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 container pt-0 pb-0">
      <div className="space-y-0">
        <VaultsList vaults={retrievedVaults} tokenAssets={assets} />
      </div>
    </div>
  )
}

export const Route = createFileRoute('/vaults/')({
  component: AllVaultsPage
})
