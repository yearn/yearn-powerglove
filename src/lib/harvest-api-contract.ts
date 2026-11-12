export interface HarvestSummary {
  datasetId: string
  reportCount: number
  startTimestamp: number
  endTimestamp: number
  chainIds: number[]
  byContractFamily: Record<string, number>
  methodology: 'published-contract-reports-v1'
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

export function assertHarvestSummary(payload: unknown): asserts payload is HarvestSummary {
  const data = payload as Partial<HarvestSummary> | null
  const families = data?.byContractFamily
  if (
    !data ||
    typeof data.datasetId !== 'string' ||
    !/^[a-f0-9]{64}$/.test(data.datasetId) ||
    data.methodology !== 'published-contract-reports-v1' ||
    !isCount(data.reportCount) ||
    !isCount(data.startTimestamp) ||
    !isCount(data.endTimestamp) ||
    data.endTimestamp - data.startTimestamp !== 7 * 86400 ||
    !Array.isArray(data.chainIds) ||
    data.chainIds.length === 0 ||
    !data.chainIds.every((id) => isCount(id) && id > 0) ||
    !families ||
    !['yearn-v2-vault', 'yearn-v3-allocator', 'yearn-v3-tokenized-strategy'].every((family) =>
      isCount(families[family])
    ) ||
    Object.values(families).some((count) => !isCount(count)) ||
    Object.values(families).reduce((sum, count) => sum + count, 0) !== data.reportCount
  ) {
    throw new Error('Weekly harvest data is invalid')
  }
}
