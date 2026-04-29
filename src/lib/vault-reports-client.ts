import { queryReports } from '@/graphql/queries/timeseries'
import { apolloClient } from '@/lib/apollo-client'
import type { VaultReportHistoryEntry } from '@/types/dataTypes'

interface VaultReportsQueryResult {
  vaultReports: VaultReportHistoryEntry[]
}

export async function fetchVaultReports(chainId: number, address: string): Promise<VaultReportHistoryEntry[]> {
  const { data } = await apolloClient.query<VaultReportsQueryResult>({
    query: queryReports,
    variables: {
      chainId,
      address
    },
    fetchPolicy: 'no-cache'
  })

  return data.vaultReports ?? []
}
