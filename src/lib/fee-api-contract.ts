/** Shared boundary for canonical fee data. Legacy APIs must not look like valid fees. */
export function assertCanonicalFeeResponse(payload: unknown, scope = 'contract'): void {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('datasetId' in payload) ||
    typeof payload.datasetId !== 'string' ||
    !('aggregationScope' in payload) ||
    payload.aggregationScope !== scope
  ) {
    throw new Error('Fee API is outdated or returned the wrong aggregation scope. Check the Yearn Data API target.')
  }
}
