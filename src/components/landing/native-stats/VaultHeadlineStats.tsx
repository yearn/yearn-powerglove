import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import type { HarvestSummary } from '@/lib/harvest-api-contract'
import { fmt, useFetch } from './hooks'
import type { TvlSummary } from './types'
import './styles.css'

function WeeklyHarvests({ chainFilter }: { chainFilter: string }) {
  const { data, loading } = useFetch<HarvestSummary>(
    chainFilter === 'all' ? '/api/harvests' : `/api/harvests?chainId=${chainFilter}`
  )
  const date = (timestamp: number) =>
    new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    })
  const title = data ? `${date(data.startTimestamp)} – ${date(data.endTimestamp - 1)} (UTC)` : undefined

  return (
    <article className="metric" aria-label="Harvests This Week" aria-busy={loading}>
      <div className="label">Harvests This Week</div>
      <div className="value" title={title}>
        {loading ? (
          <span className="skeleton stats-skeleton-value" aria-label="Loading harvest count" />
        ) : (
          (data?.reportCount.toLocaleString() ?? '—')
        )}
      </div>
    </article>
  )
}

export function VaultHeadlineStats({
  data,
  loading = false,
  chainFilter = 'all'
}: {
  data: Pick<TvlSummary, 'totalTvl' | 'vaultCount'> | null
  loading?: boolean
  chainFilter?: string
}) {
  return (
    <section className="tvl-summary-cards" aria-label="Vault statistics" aria-busy={loading}>
      <article className="metric" aria-label="Total TVL">
        <div className="label">Total TVL</div>
        <div className="value">
          {loading ? <span className="skeleton stats-skeleton-value" aria-label="Loading TVL" /> : fmt(data?.totalTvl)}
        </div>
      </article>
      <article className="metric" aria-label="Active Vaults">
        <div className="label">Active Vaults</div>
        <div className="value">
          {loading ? (
            <span className="skeleton stats-skeleton-value" aria-label="Loading active vault count" />
          ) : (
            (data?.vaultCount.active?.toLocaleString() ?? '—')
          )}
        </div>
      </article>
      <WeeklyHarvests chainFilter={chainFilter} />
    </section>
  )
}

export function VaultsHeadline() {
  const { data, loading, error, retry } = useFetch<TvlSummary>('/api/tvl')
  return (
    <div className="pg-stats vaults-headline" aria-busy={loading}>
      <VaultHeadlineStats data={data} />
      <div className="vaults-headline-footer">
        {error && (
          <output>
            Vault statistics could not be loaded.{' '}
            <button type="button" onClick={retry} className="underline">
              Retry
            </button>
          </output>
        )}
        <Link to="/stats" className="vaults-headline-link">
          See more stats <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}
