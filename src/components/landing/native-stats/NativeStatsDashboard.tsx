import { Link } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { type ReactNode, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { AuditPanel } from './AuditPanel'
import { ComparisonPanel } from './ComparisonPanel'
import { ErrorBoundary } from './ErrorBoundary'
import { FeesPanel } from './FeesPanel'
import { FeeYieldAnalysis } from './FeeYieldAnalysis'
import { defaultFeeTimeRange } from './fee-timeframe'
import { SharedStatsChartControls } from './SharedStatsChartControls'
import { StatsChainSelector } from './StatsChainSelector'
import { StatsContext, type StatsDensity, StatsTimeRangeContext } from './StatsContext'
import { TvlOverview } from './TvlOverview'
import { VaultBreakdown2 } from './VaultBreakdown2'
import './styles.css'

function AnalysisSection({
  title,
  children,
  defaultOpen = false
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <Collapsible className="stats-analysis-section" defaultOpen={defaultOpen}>
      <h2>
        <CollapsibleTrigger className="stats-analysis-trigger">
          {title}
          <ChevronDown size={16} aria-hidden="true" />
        </CollapsibleTrigger>
      </h2>
      <CollapsibleContent className="stats-analysis-content">
        <ErrorBoundary>{children}</ErrorBoundary>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function NativeStatsDashboard({ analysis = false }: { analysis?: boolean }) {
  const [range, setRange] = useState(() => defaultFeeTimeRange(Math.floor(Date.now() / 1000)))
  const rangeContext = useMemo(() => ({ range, setRange }), [range])
  const [chainFilter, setChainFilter] = useState('all')
  const density: StatsDensity = 'comfortable'
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null)
  const sectionRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const section = sectionRef.current
    const header = document.querySelector('header')
    if (!section || !header) return

    const updateOffsets = () => {
      section.style.setProperty('--stats-header-height', `${header.getBoundingClientRect().height}px`)
    }
    updateOffsets()
    const observer = new ResizeObserver(updateOffsets)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  const contextValue = useMemo(
    () => ({ chainFilter, density, lastFetchedAt, setLastFetchedAt }),
    [chainFilter, lastFetchedAt]
  )

  const chainSelector = <StatsChainSelector value={chainFilter} onValueChange={setChainFilter} />

  return (
    <StatsTimeRangeContext.Provider value={rangeContext}>
      <StatsContext.Provider value={contextValue}>
        <section ref={sectionRef} className="pg-stats">
          <div className="stats-page-panel">
            {analysis ? (
              <>
                <div className="stats-page-navigation">
                  <Link to="/" className="page-btn">
                    Back to Stats
                  </Link>
                  {chainSelector}
                </div>
                <AnalysisSection title="TVL vs Fee Yield" defaultOpen>
                  <FeeYieldAnalysis />
                </AnalysisSection>
                <AnalysisSection title="Vault Breakdown">
                  <AuditPanel />
                </AnalysisSection>
                <AnalysisSection title="Vault Breakdown 2">
                  <VaultBreakdown2 />
                </AnalysisSection>
                <AnalysisSection title="Compare TVL to DefiLlama">
                  <ComparisonPanel />
                </AnalysisSection>
              </>
            ) : (
              <>
                <SharedStatsChartControls chainSelector={chainSelector} />
                <ErrorBoundary>
                  <TvlOverview />
                </ErrorBoundary>
                <ErrorBoundary>
                  <FeesPanel />
                </ErrorBoundary>
                <div className="stats-page-navigation stats-more-analysis">
                  <Link to="/stats/analysis" className="page-btn">
                    Other Analysis
                  </Link>
                </div>
              </>
            )}
          </div>
        </section>
      </StatsContext.Provider>
    </StatsTimeRangeContext.Provider>
  )
}
