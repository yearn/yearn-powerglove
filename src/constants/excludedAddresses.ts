/**
 * Transaction `from` addresses whose deposit/withdraw actions are DAO/treasury
 * management moves rather than organic user activity (e.g. treasury rebalances
 * into a vault). Events initiated by these addresses are excluded from the
 * protocol-wide activity chart/feed and per-vault user-event views so the
 * displayed metrics reflect real user behavior.
 *
 * Comparison is case-insensitive; entries are stored lowercased.
 */
const EXCLUDED_TRANSACTION_FROM_ADDRESSES: ReadonlySet<string> = new Set(['0x283132390ea87d6ecc20255b59ba94329ee17961'])

export function isExcludedTransactionFrom(address: string | null | undefined): boolean {
  if (!address) return false
  return EXCLUDED_TRANSACTION_FROM_ADDRESSES.has(address.toLowerCase())
}
