export class CanonicalFeeResponseError extends Error {
  constructor() {
    super('Fee API is outdated or returned the wrong aggregation scope. Check the Yearn Data API target.')
    this.name = 'CanonicalFeeResponseError'
  }
}

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
    throw new CanonicalFeeResponseError()
  }
}

/** Fee payloads validated at both the server proxy and browser cache boundary. */
export function requiresCanonicalFeeResponse(path: string): boolean {
  return /^\/api\/fees(?:\/(?:vaults|history))?$/.test(path.replace(/\/$/, ''))
}
