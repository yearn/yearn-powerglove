import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { fmt, useFetch } from './hooks'
import type { TvlSummary } from './types'
import './styles.css'

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
      <article className="metric" aria-label="Weekly Harvests">
        <div className="label">Weekly Harvests</div>
        <div className="value" title="Weekly harvest counts are not available from the current data API.">
          —
        </div>
      </article>
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
