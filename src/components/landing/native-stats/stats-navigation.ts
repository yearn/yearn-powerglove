export const STATS_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'curation', label: 'Curation Products' },
  { key: 'fees', label: 'Fees' },
  { key: 'vaults', label: 'Vaults & Curation' },
  { key: 'comparison', label: 'Comparison' }
] as const

export type StatsTab = (typeof STATS_TABS)[number]['key']

export interface StatsSearch {
  tab?: StatsTab
  preview?: string
}

const STATS_TAB_KEYS = new Set<string>(STATS_TABS.map((tab) => tab.key))

export function parseStatsSearch(search: Record<string, unknown>): StatsSearch {
  const tab = typeof search.tab === 'string' && STATS_TAB_KEYS.has(search.tab) ? (search.tab as StatsTab) : undefined
  const preview = typeof search.preview === 'string' ? search.preview : undefined

  return {
    ...(tab ? { tab } : {}),
    ...(preview ? { preview } : {})
  }
}
