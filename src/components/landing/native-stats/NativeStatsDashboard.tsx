import { List, Rows3 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AuditPanel } from './AuditPanel'
import { ComparisonPanel } from './ComparisonPanel'
import { ErrorBoundary } from './ErrorBoundary'
import { FeesPanel } from './FeesPanel'
import { HAS_STATS_API, timeAgo } from './hooks'
import { StatsContext, type StatsDensity } from './StatsContext'
import { TvlOverview } from './TvlOverview'
import './styles.css'

type StatsTab = 'overview' | 'fees' | 'vaults' | 'comparison'

const STATS_TABS: Array<{ key: StatsTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'fees', label: 'Fees' },
  { key: 'vaults', label: 'Vaults & Curation' },
  { key: 'comparison', label: 'Comparison' }
]

const CHAINS = [
  { id: 'all', label: 'All Chains' },
  { id: '1', label: 'Ethereum' },
  { id: '10', label: 'Optimism' },
  { id: '137', label: 'Polygon' },
  { id: '42161', label: 'Arbitrum' },
  { id: '8453', label: 'Base' },
  { id: '100', label: 'Gnosis' },
  { id: '747474', label: 'Katana' },
  { id: '80094', label: 'Berachain' },
  { id: '146', label: 'Sonic' }
]

function MissingApiNotice() {
  return (
    <div className="card">
      <h2>Yearn Metrics API not configured</h2>
      <p className="text-dim" style={{ marginTop: '0.5rem', lineHeight: 1.6 }}>
        Set <code>VITE_PUBLIC_YEARN_METRICS_API_URL</code> to a reachable yearn-metrics API base. On a forwarded local
        lane, the expected value is usually <code>http://127.0.0.1:5456</code>.
      </p>
    </div>
  )
}

export function NativeStatsDashboard() {
  const [tab, setTab] = useState<StatsTab>('overview')
  const [chainFilter, setChainFilter] = useState('all')
  const [density, setDensity] = useState<StatsDensity>('comfortable')
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null)

  const contextValue = useMemo(
    () => ({ chainFilter, density, lastFetchedAt, setLastFetchedAt }),
    [chainFilter, density, lastFetchedAt]
  )

  return (
    <StatsContext.Provider value={contextValue}>
      <section className="pg-stats">
        <div className="top-bar">
          <div>
            <div className="top-bar-title">Yearn Metrics</div>
            <div className="top-bar-subtitle">TVL, fees, curation, and DefiLlama reconciliation</div>
          </div>
          <div className="toolbar-right">
            {lastFetchedAt && (
              <span className="freshness-indicator" title={new Date(lastFetchedAt).toLocaleTimeString()}>
                <span className={`freshness-dot${Date.now() - lastFetchedAt > 5 * 60_000 ? ' stale' : ''}`} />
                <span className="text-dim" style={{ fontSize: '0.7rem' }}>
                  {timeAgo(lastFetchedAt)}
                </span>
              </span>
            )}
            <select
              className="filter-select"
              value={chainFilter}
              onChange={(event) => setChainFilter(event.target.value)}
            >
              {CHAINS.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.label}
                </option>
              ))}
            </select>
            <fieldset className="density-toggle" aria-label="Table density">
              <button
                type="button"
                className={density === 'comfortable' ? 'active' : ''}
                onClick={() => setDensity('comfortable')}
                title="Comfortable"
                aria-pressed={density === 'comfortable'}
              >
                <Rows3 className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Comfortable density</span>
              </button>
              <button
                type="button"
                className={density === 'compact' ? 'active' : ''}
                onClick={() => setDensity('compact')}
                title="Compact"
                aria-pressed={density === 'compact'}
              >
                <List className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Compact density</span>
              </button>
            </fieldset>
          </div>
        </div>

        <div className="stats-tabs-shell">
          <Tabs value={tab} onValueChange={(value) => setTab(value as StatsTab)} className="w-full">
            <TabsList className="stats-tabs-list">
              {STATS_TABS.map((item) => (
                <TabsTrigger key={item.key} value={item.key} className="stats-tab">
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="stats-tab-panel">
              {!HAS_STATS_API ? <MissingApiNotice /> : null}
              {HAS_STATS_API ? (
                <>
                  <TabsContent value="overview" className="mt-0">
                    <ErrorBoundary>
                      <TvlOverview />
                    </ErrorBoundary>
                  </TabsContent>
                  <TabsContent value="fees" className="mt-0">
                    <ErrorBoundary>
                      <FeesPanel />
                    </ErrorBoundary>
                  </TabsContent>
                  <TabsContent value="vaults" className="mt-0">
                    <ErrorBoundary>
                      <AuditPanel />
                    </ErrorBoundary>
                  </TabsContent>
                  <TabsContent value="comparison" className="mt-0">
                    <ErrorBoundary>
                      <ComparisonPanel />
                    </ErrorBoundary>
                  </TabsContent>
                </>
              ) : null}
            </div>
          </Tabs>
        </div>
      </section>
    </StatsContext.Provider>
  )
}
