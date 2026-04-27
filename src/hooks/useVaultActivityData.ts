import { useQuery } from '@tanstack/react-query'
import { fetchVaultActivityData } from '@/lib/vault-activity-client'
import type { VaultActivityData } from '@/types/vaultActivityTypes'

interface UseVaultActivityDataReturn {
  data: VaultActivityData | null
  isLoading: boolean
  error: Error | null
}

export function useVaultActivityData(
  vaultAddress: string | undefined,
  chainId: number | undefined
): UseVaultActivityDataReturn {
  const normalizedAddress = vaultAddress?.toLowerCase()

  const { data, isLoading, error } = useQuery<VaultActivityData | null, Error>({
    queryKey: ['vault-activity', chainId, normalizedAddress],
    queryFn: () => fetchVaultActivityData({ chainId: chainId!, vaultAddress: normalizedAddress! }),
    enabled: Boolean(chainId && normalizedAddress),
    staleTime: 5 * 60 * 1000,
    retry: false
  })

  return {
    data: data ?? null,
    isLoading,
    error: error ?? null
  }
}
