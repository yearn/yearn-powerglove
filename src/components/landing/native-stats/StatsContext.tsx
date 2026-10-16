import { createContext } from 'react'

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
