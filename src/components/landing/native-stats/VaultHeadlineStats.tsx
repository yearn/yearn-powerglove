import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import type { HarvestSummary } from '@/lib/harvest-api-contract'
import { fmt, useFetch } from './hooks'
import type { TvlSummary } from './types'
import './styles.css'

function WeeklyHarvests() {
  const { data, loading, error, retry } = useFetch<HarvestSummary>('/api/harvests')
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
        {data?.reportCount.toLocaleString() ?? '—'}
      </div>
      {error && (
        <button type="button" onClick={retry} className="text-xs underline" aria-label="Retry harvests this week">
          Retry
        </button>
      )}
    </article>
  )
}

export function VaultHeadlineStats({ data }: { data: Pick<TvlSummary, 'totalTvl' | 'vaultCount'> | null }) {
  return (
    <section className="tvl-summary-cards" aria-label="Vault statistics">
      <article className="metric" aria-label="Total TVL">
        <div className="label">Total TVL</div>
        <div className="value">{fmt(data?.totalTvl)}</div>
      </article>
      <article className="metric" aria-label="Active Vaults">
        <div className="label">Active Vaults</div>
        <div className="value">{data?.vaultCount.active?.toLocaleString() ?? '—'}</div>
      </article>
      <WeeklyHarvests />
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
