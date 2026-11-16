import { useQuery } from '@tanstack/react-query'

export type PendingTimelockStrategy = {
  chainId: number
  vaultAddress: string
  strategyAddress: string
  timelockAddress: string
  operationId: string
  scheduleTxHash: string
  status: 'queued' | 'ready'
  queuedAt: number
  eta: number
  executorLabel: string
  strategyName?: string
  maxDebtRaw?: string
}

const addressPattern = /^0x[\da-f]{40}$/i
const hashPattern = /^0x[\da-f]{64}$/i

export function parsePendingTimelockStrategies(
  payload: unknown,
  chainId: number,
  vaultAddress: string
): PendingTimelockStrategy[] {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('chainId' in payload) ||
    payload.chainId !== chainId ||
    !('vaultAddress' in payload) ||
    typeof payload.vaultAddress !== 'string' ||
    payload.vaultAddress.toLowerCase() !== vaultAddress.toLowerCase() ||
    !('items' in payload) ||
    !Array.isArray(payload.items)
  )
    throw new Error('Invalid pending strategy response')
  return payload.items.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid pending strategy')
    const row = item as Record<string, unknown>
    if (
      row.chainId !== chainId ||
      typeof row.vaultAddress !== 'string' ||
      row.vaultAddress.toLowerCase() !== vaultAddress.toLowerCase() ||
      !['strategyAddress', 'timelockAddress'].every(
        (key) => typeof row[key] === 'string' && addressPattern.test(row[key] as string)
      ) ||
      !['operationId', 'scheduleTxHash'].every(
        (key) => typeof row[key] === 'string' && hashPattern.test(row[key] as string)
      ) ||
      (row.status !== 'queued' && row.status !== 'ready') ||
      !['queuedAt', 'eta'].every(
        (key) => typeof row[key] === 'number' && Number.isSafeInteger(row[key]) && (row[key] as number) > 0
      ) ||
      typeof row.executorLabel !== 'string' ||
      (row.strategyName !== undefined && typeof row.strategyName !== 'string') ||
      (row.maxDebtRaw !== undefined && (typeof row.maxDebtRaw !== 'string' || !/^\d+$/.test(row.maxDebtRaw)))
    )
      throw new Error('Invalid pending strategy')
    return row as PendingTimelockStrategy
  })
}

export function usePendingTimelockStrategies(chainId: number, vaultAddress: string, enabled: boolean) {
  return useQuery({
    queryKey: ['pending-timelock-strategies', chainId, vaultAddress.toLowerCase()],
    enabled: enabled && addressPattern.test(vaultAddress),
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ chainId: String(chainId), vault: vaultAddress })
      const response = await fetch(`https://yearn.fi/api/vaults/timelock-strategies?${params}`, { signal })
      if (!response.ok) throw new Error('Pending strategy changes are unavailable')
      return parsePendingTimelockStrategies(await response.json(), chainId, vaultAddress)
    },
    staleTime: 60_000,
    refetchInterval: 60_000
  })
}
