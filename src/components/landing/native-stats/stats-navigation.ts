export const STATS_TABS = [
  { key: 'overview', label: 'TVL' },
  { key: 'fees', label: 'Fees' },
  { key: 'analysis', label: 'Other Analysis' }
] as const

export type StatsTab = (typeof STATS_TABS)[number]['key']

export interface StatsSearch {
  tab?: StatsTab
  preview?: string
}

const LEGACY_STATS_TABS = new Map<string, StatsTab>([
  ['vaults', 'overview'],
  ['curation', 'analysis'],
  ['comparison', 'analysis']
])

const STATS_TAB_KEYS = new Set<string>(STATS_TABS.map((tab) => tab.key))

export function parseStatsSearch(search: Record<string, unknown>): StatsSearch {
  const requestedTab = typeof search.tab === 'string' ? (LEGACY_STATS_TABS.get(search.tab) ?? search.tab) : undefined
  const tab = requestedTab && STATS_TAB_KEYS.has(requestedTab) ? (requestedTab as StatsTab) : undefined
  const preview = typeof search.preview === 'string' ? search.preview : undefined

  return {
    ...(tab ? { tab } : {}),
    ...(preview ? { preview } : {})
  }
}
