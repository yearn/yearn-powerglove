import { type Chain, createPublicClient, http } from 'viem'
import { arbitrum, base, berachain, fantom, gnosis, katana, mainnet, optimism, polygon } from 'viem/chains'
import type { ChainId } from '@/constants/chains'

const CHAIN_CONFIGS = {
  1: mainnet,
  10: optimism,
  100: gnosis,
  137: polygon,
  250: fantom,
  8453: base,
  42161: arbitrum,
  747474: katana,
  80094: berachain
} as const satisfies Record<ChainId, Chain>

const getRpcUrl = (chainId: ChainId): string | undefined => {
  const env = import.meta.env as Record<string, string | undefined>
  const value = env[`VITE_RPC_URI_FOR_${chainId}`]
  return value && value.trim().length > 0 ? value : undefined
}

const createChainClient = (chainId: ChainId) =>
  createPublicClient({
    chain: CHAIN_CONFIGS[chainId],
    transport: http(getRpcUrl(chainId))
  })

type SupportedPublicClient = ReturnType<typeof createChainClient>

const clients = new Map<ChainId, SupportedPublicClient>()

export function getPublicClient(chainId: ChainId): SupportedPublicClient {
  const cached = clients.get(chainId)
  if (cached) return cached

  const client = createChainClient(chainId)
  clients.set(chainId, client)
  return client
}
