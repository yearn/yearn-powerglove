import { YearnSpinner } from '@/components/utils/YearnLoader'

function CenteredSpinner() {
  return (
    <div className="stats-skeleton-spinner" aria-hidden="true">
      <YearnSpinner size={48} />
    </div>
  )
}

/** Loading frames share section classes and size tokens with the hydrated dashboard. */
function Line({ width = '65%' }: { width?: string }) {
  return <div className="skeleton skeleton-line" style={{ width }} />
}

export function StatsPlotSkeleton({ tvl = false, chain = false }: { tvl?: boolean; chain?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`stats-skeleton-plot ${tvl ? 'stats-skeleton-plot-tvl' : chain ? 'stats-skeleton-plot-chain' : ''}`}
    >
      <div className="skeleton" />
      <CenteredSpinner />
    </div>
  )
}

export function StatsChartSkeleton({
  title,
  kind = 'breakdown'
}: {
  title: string
  kind?: 'tvl' | 'overall' | 'breakdown' | 'comparison' | 'yield' | 'chain' | 'type'
}) {
  return (
    <section className={`card fee-chart-card stats-chart-${kind}`} aria-label={`Loading ${title}`} aria-busy="true">
      <div aria-hidden="true" className="stats-skeleton-chart-header">
        <div className="stats-skeleton-chart-heading">
          <h2>{title}</h2>
          <div className="stats-skeleton-controls">
            <span className="skeleton" />
            <span className="skeleton" />
          </div>
          {kind === 'comparison' && <div className="skeleton stats-skeleton-picker" />}
        </div>
        {kind !== 'tvl' && (
          <div className="stats-skeleton-controls stats-skeleton-legends">
            {Array.from({ length: kind === 'chain' ? 9 : kind === 'comparison' ? 6 : 4 }, (_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Static series placeholders.
              <span key={index} className="skeleton" />
            ))}
          </div>
        )}
      </div>
      <StatsPlotSkeleton tvl={kind === 'tvl'} />
    </section>
  )
}

export function StatsTableSkeleton({ monthly = false, bodyOnly = false }: { monthly?: boolean; bodyOnly?: boolean }) {
  const title = monthly ? 'Monthly Vault Earnings' : 'Adjusted TVL and Fees by Vault'
  const columns = monthly
    ? ['Vault', 'annual total', ...Array.from({ length: 12 }, (_, index) => `Month ${index + 1}`)]
    : ['Vault', 'Adjusted TVL', 'Reported TVL', 'Performance fee', 'Management fee']
  const body = (
    <div className="stats-skeleton-table-frame">
      <div
        className={`monthly-fee-table-scroll stats-skeleton-table ${monthly ? 'stats-skeleton-monthly-table' : ''}`}
        aria-hidden="true"
      >
        <table className="monthly-fee-table monthly-fee-skeleton">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column.startsWith('Month ') ? <Line /> : column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: monthly ? 12 : 10 }, (_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Static loading placeholders.
              <tr key={index}>
                {columns.map((column, columnIndex) => (
                  <td key={column}>
                    <Line />
                    {columnIndex === 0 && (
                      <div className="mt-2">
                        <Line width="45%" />
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CenteredSpinner />
    </div>
  )
  if (bodyOnly) return body
  return (
    <section className="monthly-vault-fees" aria-label={`Loading ${title}`} aria-busy="true">
      <div className={`monthly-fee-toolbar ${monthly ? 'stats-monthly-toolbar' : 'stats-effective-toolbar'}`}>
        <div>
          <h2>{title}</h2>
          {monthly && (
            <div aria-hidden="true" className="mt-2">
              <Line />
            </div>
          )}
        </div>
        <div aria-hidden="true" className="stats-skeleton-controls">
          <span className="skeleton" />
          <span className="skeleton" />
        </div>
      </div>
      {body}
      <div
        aria-hidden="true"
        className={`monthly-fee-footer stats-skeleton-pagination ${monthly ? 'stats-monthly-footer' : ''}`}
      >
        {monthly && <Line width="12rem" />}
        <div className="skeleton" style={{ width: '12rem', height: 32 }} />
      </div>
    </section>
  )
}

export function StatsFeeSummarySkeleton() {
  return (
    <div className="fee-summary-grid" aria-label="Loading earnings and fee totals" aria-busy="true">
      {['Gross Fees', 'Net Yield', 'Gross Gains', 'Losses'].map((title) => (
        <section className="fee-summary-stat" key={title}>
          <div className="label stats-skeleton-metric-title">{title}</div>
          <dl className="fee-summary-values">
            {['All time', 'Selected range'].map((label) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  <span className="skeleton stats-skeleton-value" />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}

export function StatsTvlSkeleton({ chainCount = 9 }: { chainCount?: number }) {
  return (
    <>
      <StatsChartSkeleton title="TVL History" kind="tvl" />
      <section className="card" aria-label="Loading TVL by Chain" aria-busy="true">
        <h2>TVL by Chain</h2>
        <div aria-hidden="true" className="relative" style={{ marginTop: '0.25rem' }}>
          {Array.from({ length: chainCount }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Static loading placeholders.
            <div className="stat-row chain-stat-row stats-skeleton-chain-row" key={index}>
              <Line width="6rem" />
              <div className="skeleton stats-skeleton-chain-bar" />
              <Line width="4rem" />
            </div>
          ))}
          <CenteredSpinner />
        </div>
      </section>
    </>
  )
}

export function StatsFeesSkeleton() {
  return (
    <div className="fees-panel" aria-busy="true">
      <output className="sr-only">Loading fee data</output>
      <StatsTableSkeleton />
      <section className="earnings-fees-section">
        <StatsFeeSummarySkeleton />
        <div className="row fee-chart-row">
          <StatsChartSkeleton title="Monthly Earnings & Fees" kind="overall" />
          <StatsChartSkeleton title="Monthly Fees per $1 of TVL (Annualized)" kind="yield" />
          <StatsChartSkeleton title="Earnings by Chain" kind="chain" />
          <StatsChartSkeleton title="Earnings by Vault Type" kind="type" />
          <StatsChartSkeleton title="Earnings by Vault" kind="comparison" />
          <StatsTableSkeleton monthly />
        </div>
      </section>
    </div>
  )
}
