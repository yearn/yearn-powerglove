import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AuditPanel } from './AuditPanel'
import { ComparisonPanel } from './ComparisonPanel'
import { CurationProductsPanel } from './CurationProductsPanel'
import { ErrorBoundary } from './ErrorBoundary'
import { FeesPanel } from './FeesPanel'
import { HAS_FEES_API, HAS_TVL_API } from './hooks'
import { StatsChainSelector } from './StatsChainSelector'
import { StatsContext, type StatsDensity } from './StatsContext'
import { STATS_TABS, type StatsTab } from './stats-navigation'
import { TvlOverview } from './TvlOverview'
import './styles.css'

function MissingApiNotice({ lane }: { lane: 'TVL' | 'fees' }) {
  const environmentVariable = lane === 'TVL' ? 'VITE_PUBLIC_YEARN_TVL_API_URL' : 'VITE_PUBLIC_YEARN_FEES_API_URL'
  const localPort = lane === 'TVL' ? '3460' : '3482'
  return (
    <div className="card">
      <h2>Yearn {lane} API not configured</h2>
      <p className="text-dim" style={{ marginTop: '0.5rem', lineHeight: 1.6 }}>
        Set <code>{environmentVariable}</code> to a reachable service base. The local proxy expects{' '}
        <code>http://127.0.0.1:{localPort}</code> by default.
      </p>
    </div>
  )
}

export function NativeStatsDashboard({ tab, onTabChange }: { tab: StatsTab; onTabChange: (tab: StatsTab) => void }) {
  const [chainFilter, setChainFilter] = useState('all')
  const density: StatsDensity = 'comfortable'
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const section = sectionRef.current
    const tabs = tabsRef.current
    const header = document.querySelector('header')
    if (!section || !tabs || !header) return

    const updateOffsets = () => {
      section.style.setProperty('--stats-header-height', `${header.getBoundingClientRect().height}px`)
      section.style.setProperty('--stats-tabs-height', `${tabs.getBoundingClientRect().height}px`)
    }
    updateOffsets()
    const observer = new ResizeObserver(updateOffsets)
    observer.observe(header)
    observer.observe(tabs)
    return () => observer.disconnect()
  }, [])

  const contextValue = useMemo(
    () => ({ chainFilter, density, lastFetchedAt, setLastFetchedAt }),
    [chainFilter, lastFetchedAt]
  )

  const chainSelector = <StatsChainSelector value={chainFilter} onValueChange={setChainFilter} />

  return (
    <StatsContext.Provider value={contextValue}>
      <section ref={sectionRef} className="pg-stats">
        <div className="stats-tabs-shell">
          <Tabs value={tab} onValueChange={(value) => onTabChange(value as StatsTab)} className="w-full">
            <TabsList ref={tabsRef} className="stats-tabs-list">
              {STATS_TABS.map((item) => (
                <TabsTrigger key={item.key} value={item.key} className="stats-tab">
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className={`stats-tab-panel${tab === 'fees' ? ' stats-fees-tab-panel' : ''}`}>
              {tab !== 'fees' && <div className="stats-chain-filter">{chainSelector}</div>}
              <TabsContent value="overview" className="mt-0">
                {!HAS_TVL_API ? (
                  <MissingApiNotice lane="TVL" />
                ) : (
                  <ErrorBoundary>
                    <TvlOverview />
                  </ErrorBoundary>
                )}
              </TabsContent>
              <TabsContent value="curation" className="mt-0">
                {!HAS_TVL_API ? (
                  <MissingApiNotice lane="TVL" />
                ) : (
                  <ErrorBoundary>
                    <CurationProductsPanel />
                  </ErrorBoundary>
                )}
              </TabsContent>
              <TabsContent value="fees" className="mt-0">
                {!HAS_FEES_API ? (
                  <MissingApiNotice lane="fees" />
                ) : (
                  <ErrorBoundary>
                    <FeesPanel chainSelector={chainSelector} />
                  </ErrorBoundary>
                )}
              </TabsContent>
              <TabsContent value="vaults" className="mt-0">
                {!HAS_TVL_API ? (
                  <MissingApiNotice lane="TVL" />
                ) : (
                  <ErrorBoundary>
                    <AuditPanel />
                  </ErrorBoundary>
                )}
              </TabsContent>
              <TabsContent value="comparison" className="mt-0">
                {!HAS_TVL_API ? (
                  <MissingApiNotice lane="TVL" />
                ) : (
                  <ErrorBoundary>
                    <ComparisonPanel />
                  </ErrorBoundary>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </section>
    </StatsContext.Provider>
  )
}
