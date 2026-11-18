import { createContext } from 'react'
import type { ChartDateRange } from '@/components/charts/chart-utils'

export type StatsDensity = 'comfortable' | 'compact'

export interface StatsContextValue {
  chainFilter: string
  density: StatsDensity
  lastFetchedAt: number | null
  setLastFetchedAt: (timestamp: number) => void
}

export const StatsContext = createContext<StatsContextValue>({
  chainFilter: 'all',
  density: 'comfortable',
  lastFetchedAt: null,
  setLastFetchedAt: () => {}
})

export const StatsTimeRangeContext = createContext<{
  range: ChartDateRange | null
  setRange: (range: ChartDateRange) => void
}>({ range: null, setRange: () => {} })
