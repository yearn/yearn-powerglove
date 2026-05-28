import { createFileRoute } from '@tanstack/react-router'
import YearnLoader from '@/components/utils/YearnLoader'
import { VaultsList } from '@/components/vaults-list'
import { useVaults } from '@/contexts/useVaults'
import type { Vault } from '@/types/vaultTypes'
import { useTokenAssetsContext } from '../contexts/useTokenAssets'

export default function AllVaultsPage() {
  const { vaults, loading, error, loadingState } = useVaults()
  const { assets, loading: assetsLoading, error: assetsError } = useTokenAssetsContext()
  const retrievedVaults: Vault[] = vaults || []

  if (loading || assetsLoading) {
    return (
      <main className="min-h-screen w-full max-w-[1400px] px-0 py-0">
        <YearnLoader enhancedLoadingState={loadingState} showProgress={true} />
      </main>
    )
  }

  if (error || assetsError) {
    return (
      <main className="min-h-screen w-full max-w-[1400px] border-x border-b border-border bg-white p-6 px-0 py-0">
        <div className="px-6 py-6 text-red-500">
          Error loading vaults: {error?.message || assetsError?.message || 'Unknown error'}
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 container pt-0 pb-0">
      <VaultsList vaults={retrievedVaults} tokenAssets={assets} />
    </main>
  )
}

export const Route = createFileRoute('/')({
  component: AllVaultsPage
})
