import { normalizeVaultActivityData } from '@/lib/vault-activity'
import type { VaultActivityData } from '@/types/vaultActivityTypes'

interface FetchVaultActivityDataParams {
  chainId: number
  vaultAddress: string
}

function getYearnFiActivityApiBaseUrl(): string {
  return import.meta.env.VITE_PUBLIC_YEARNFI_API_URL?.trim() ?? ''
}

export function getVaultActivityFixtureUrl(chainId: number, vaultAddress: string): string {
  return `/data/vault-activity/${chainId}/${vaultAddress.toLowerCase()}.json`
}

export function getYearnFiVaultActivityUrl(baseUrl: string, chainId: number, vaultAddress: string): string {
  const url = new URL('/api/vault-activity', baseUrl)
  url.searchParams.set('chainId', String(chainId))
  url.searchParams.set('vaultAddress', vaultAddress.toLowerCase())
  return url.toString()
}

function getVaultActivityCandidateUrls(chainId: number, vaultAddress: string): string[] {
  const urls = [getVaultActivityFixtureUrl(chainId, vaultAddress)]
  const apiBaseUrl = getYearnFiActivityApiBaseUrl()

  if (apiBaseUrl) {
    urls.push(getYearnFiVaultActivityUrl(apiBaseUrl, chainId, vaultAddress))
  }

  return urls
}

async function fetchActivityJson(url: string): Promise<unknown | null> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Vault activity request failed (${response.status}) for ${url}`)
  }

  return response.json()
}

export async function fetchVaultActivityData({
  chainId,
  vaultAddress
}: FetchVaultActivityDataParams): Promise<VaultActivityData | null> {
  for (const url of getVaultActivityCandidateUrls(chainId, vaultAddress)) {
    const json = await fetchActivityJson(url)
    if (json === null) {
      continue
    }

    return normalizeVaultActivityData(json)
  }

  return null
}
