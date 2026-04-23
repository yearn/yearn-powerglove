const KONG_GQL_URL = import.meta.env.VITE_PUBLIC_GRAPHQL_URL || 'https://kong.yearn.fi/api/gql'

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/

interface KongGraphqlResponse<TData> {
  data?: TData
  errors?: Array<{ message?: string }>
}

interface KongStrategyNode {
  address?: string | null
  name?: string | null
  meta?: { displayName?: string | null } | null
}

interface KongVaultNode {
  address?: string | null
  name?: string | null
  meta?: { displayName?: string | null } | null
}

function isAddress(value: string): boolean {
  return ADDRESS_PATTERN.test(value)
}

function normalizeAddress(address: string): string {
  return address.toLowerCase()
}

function buildAddressNamesQuery(chainId: number, addresses: string[]): string {
  const fields = addresses
    .map(
      (address, index) => `
      strategy${index}: strategy(chainId: ${chainId}, address: "${address}") {
        address
        name
        meta {
          displayName
        }
      }
      vault${index}: vault(chainId: ${chainId}, address: "${address}") {
        address
        name
        meta {
          displayName
        }
      }`
    )
    .join('\n')

  return `query FetchAddressNames {
    ${fields}
  }`
}

function preferredName(
  node:
    | {
        name?: string | null
        meta?: { displayName?: string | null } | null
      }
    | null
    | undefined
): string | null {
  if (!node) return null
  return node.meta?.displayName?.trim() || node.name?.trim() || null
}

export interface NameInfo {
  name: string
  fromVault: boolean
}

function selectDisplayName(
  strategyNode: KongStrategyNode | null | undefined,
  vaultNode: KongVaultNode | null | undefined
): { name: string | null; fromVault: boolean } {
  const strategyName = preferredName(strategyNode)
  if (strategyName) return { name: strategyName, fromVault: false }
  const vaultName = preferredName(vaultNode)
  if (vaultName) return { name: vaultName, fromVault: true }
  return { name: null, fromVault: false }
}

function mergeNamesFromPayload(
  payloadData: Record<string, KongStrategyNode | KongVaultNode | null>,
  addresses: string[]
): Record<string, NameInfo> {
  const byAddress: Record<string, NameInfo> = {}

  for (let index = 0; index < addresses.length; index += 1) {
    const strategyNode = payloadData[`strategy${index}`] as KongStrategyNode | null | undefined
    const vaultNode = payloadData[`vault${index}`] as KongVaultNode | null | undefined
    const result = selectDisplayName(strategyNode, vaultNode)
    if (!result.name) continue

    byAddress[normalizeAddress(addresses[index])] = {
      name: result.name,
      fromVault: result.fromVault
    }
  }

  return byAddress
}

export async function fetchStrategyDisplayNames(
  chainId: number,
  strategyAddresses: string[]
): Promise<Record<string, NameInfo>> {
  const normalizedAddresses = [...new Set(strategyAddresses.map(normalizeAddress))].filter(isAddress)
  if (normalizedAddresses.length === 0) return {}

  const response = await fetch(KONG_GQL_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: buildAddressNamesQuery(chainId, normalizedAddresses)
    })
  })

  if (!response.ok) {
    throw new Error(`Kong query failed with status ${response.status}`)
  }

  const payload = (await response.json()) as KongGraphqlResponse<
    Record<string, KongStrategyNode | KongVaultNode | null>
  >
  if (payload.errors && payload.errors.length > 0) {
    throw new Error(payload.errors[0]?.message || 'Kong query returned errors')
  }

  if (!payload.data) return {}

  return mergeNamesFromPayload(payload.data, normalizedAddresses)
}

interface KongVaultStrategy {
  address: string
  name: string | null
}

interface KongVaultStrategiesResponse {
  vaultStrategies?: KongVaultStrategy[] | null
}

function buildVaultStrategiesQuery(chainId: number, vaultAddress: string): string {
  return `
    query VaultStrategies {
      vaultStrategies(chainId: ${chainId}, vault: "${vaultAddress}") {
        address
        name
      }
    }
  `
}

export async function fetchVaultStrategies(chainId: number, vaultAddress: string): Promise<Map<string, string>> {
  if (!isAddress(vaultAddress)) return new Map()

  const response = await fetch(KONG_GQL_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: buildVaultStrategiesQuery(chainId, vaultAddress)
    })
  })

  if (!response.ok) {
    throw new Error(`Kong query failed with status ${response.status}`)
  }

  const payload = (await response.json()) as KongGraphqlResponse<KongVaultStrategiesResponse>
  if (payload.errors && payload.errors.length > 0) {
    throw new Error(payload.errors[0]?.message || 'Kong query returned errors')
  }

  const nameToAddress = new Map<string, string>()
  const strategies = payload.data?.vaultStrategies
  if (!strategies) return nameToAddress

  for (const strategy of strategies) {
    if (!strategy.address) continue
    const normalizedName = strategy.name?.trim().toLowerCase()
    if (normalizedName) {
      nameToAddress.set(normalizedName, strategy.address.toLowerCase())
    }
  }

  return nameToAddress
}
