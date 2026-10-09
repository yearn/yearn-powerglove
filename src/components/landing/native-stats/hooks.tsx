import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'

type StatsApiLane = 'tvl' | 'tvl-analytics' | 'fees' | 'fee-analytics'

function isLocalStatsHost(): boolean {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    const isTailscaleIp = /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/.test(hostname)
    if (hostname === '127.0.0.1' || hostname === 'localhost' || hostname.endsWith('.ts.net') || isTailscaleIp) {
      return true
    }
  }
  return false
}

export function getStatsApiLane(url: string): StatsApiLane {
  const path = url.split('?')[0].replace(/\/$/, '')
  if (
    [
      '/api/tvl',
      '/api/tvl/history/runs/latest',
      '/api/tvl/history/runs/latest/constant-price',
      '/api/tvl/curation-products',
      '/api/audit/tree',
      '/api/analytics/publication',
      '/api/comparison/defillama-comparable',
      '/api/comparison'
    ].includes(path)
  )
    return 'tvl'
  if (['/api/fees', '/api/fees/history', '/api/fees/vaults', '/api/fees/stack', '/api/profitability'].includes(path))
    return 'fees'
  return path.startsWith('/api/fees') || path.startsWith('/api/profitability') ? 'fee-analytics' : 'tvl-analytics'
}

export function resolveStatsApiBase(lane: StatsApiLane): string | null {
  if (isLocalStatsHost()) return ''

  const configuredUrl = (
    lane === 'tvl'
      ? import.meta.env.VITE_PUBLIC_YEARN_DATA_API_URL || import.meta.env.VITE_PUBLIC_YEARN_TVL_API_URL
      : lane === 'tvl-analytics'
        ? import.meta.env.VITE_PUBLIC_YEARN_TVL_API_URL
        : lane === 'fees'
          ? import.meta.env.VITE_PUBLIC_YEARN_DATA_API_URL || import.meta.env.VITE_PUBLIC_YEARN_FEES_API_URL
          : import.meta.env.VITE_PUBLIC_YEARN_FEES_API_URL
  )?.trim()
  const legacyUrl = import.meta.env.VITE_PUBLIC_YEARN_METRICS_API_URL?.trim()
  const apiUrl = configuredUrl || legacyUrl

  if (apiUrl) {
    return apiUrl.replace(/\/$/, '')
  }

  return null
}

export const HAS_TVL_API = resolveStatsApiBase('tvl') !== null
export const HAS_FEES_API = resolveStatsApiBase('fees') !== null

const fetchCache = new Map<string, { data: unknown; timestamp: number }>()
const inFlightFetches = new Map<string, Promise<{ payload: unknown; timestamp: number; status: number }>>()
const CACHE_TTL = 5 * 60 * 1000

const preparedAnalyticsPaths = new Set([
  '/api/fees/stack',
  '/api/profitability',
  '/api/comparison',
  '/api/comparison/defillama-comparable'
])
const analyticsSelections = new Map<string, Promise<string | null>>()
async function selectedAnalyticsUrl(key: string, url: string, apiBase: string): Promise<string> {
  if (!preparedAnalyticsPaths.has(url.split('?')[0])) return key
  let selection = analyticsSelections.get(apiBase)
  if (!selection) {
    selection = fetch(`${apiBase}/api/analytics/publication`)
      .then(async (response) => {
        if (response.status === 404) return null // Existing legacy origins have no publication route.
        if (!response.ok) throw new Error('Analytics publication could not be loaded')
        const data = await response.json()
        if (!/^[a-f0-9]{64}$/.test(data.publicationId)) throw new Error('Invalid analytics publication')
        return data.publicationId as string
      })
      .catch((error) => {
        analyticsSelections.delete(apiBase)
        throw error
      })
    analyticsSelections.set(apiBase, selection)
  }
  const id = await selection
  return id ? `${key}${url.includes('?') ? '&' : '?'}publicationId=${id}` : key
}

interface UseFetchOptions {
  enabled?: boolean
}

interface HttpError extends Error {
  status: number
}

interface FetchState<T> {
  key: string
  data: T | null
  loading: boolean
  error: string | null
  status: number | null
  fetchedAt: number | null
}

export function useFetch<T>(url: string, options: UseFetchOptions = {}) {
  const apiBase = resolveStatsApiBase(getStatsApiLane(url)) ?? ''
  const key = `${apiBase}${url}`
  const enabled = options.enabled ?? true
  const [state, setState] = useState<FetchState<T>>(() => {
    const cached = fetchCache.get(key)
    const fresh = cached && Date.now() - cached.timestamp < CACHE_TTL ? cached : null
    return {
      key,
      data: (fresh?.data as T) ?? null,
      loading: enabled && !fresh,
      error: null,
      status: fresh ? 200 : null,
      fetchedAt: fresh?.timestamp ?? null
    }
  })
  const requestIdRef = useRef(0)

  const doFetch = useCallback(
    (bypassCache = false) => {
      if (!enabled) return
      requestIdRef.current += 1
      const requestId = requestIdRef.current
      const cached = fetchCache.get(key)
      if (!bypassCache && cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setState({ key, data: cached.data as T, loading: false, error: null, status: 200, fetchedAt: cached.timestamp })
        return
      }
      setState((previous) => ({
        key,
        data: previous.key === key ? previous.data : null,
        loading: true,
        error: null,
        status: null,
        fetchedAt: previous.key === key ? previous.fetchedAt : null
      }))
      let request = !bypassCache ? inFlightFetches.get(key) : undefined
      if (!request) {
        const pending = selectedAnalyticsUrl(key, url, apiBase)
          .then(fetch)
          .then(async (response) => {
            if (!response.ok) {
              const payload = (await response.json().catch(() => null)) as { error?: string } | null
              const error = new Error(payload?.error || `${response.status} ${response.statusText}`) as HttpError
              error.status = response.status
              throw error
            }
            return { payload: await response.json(), timestamp: Date.now(), status: response.status }
          })
          .then((result) => {
            if (inFlightFetches.get(key) === pending)
              fetchCache.set(key, { data: result.payload, timestamp: result.timestamp })
            return result
          })
          .finally(() => {
            if (inFlightFetches.get(key) === pending) inFlightFetches.delete(key)
          })
        inFlightFetches.set(key, pending)
        request = pending
      }
      request
        .then(({ payload, timestamp, status }) => {
          if (requestId === requestIdRef.current)
            setState({ key, data: payload as T, loading: false, error: null, status, fetchedAt: timestamp })
        })
        .catch((error: HttpError) => {
          if (requestId === requestIdRef.current)
            setState({
              key,
              data: null,
              loading: false,
              error: error.message,
              status: error.status ?? null,
              fetchedAt: null
            })
        })
    },
    [enabled, key, url, apiBase]
  )

  useEffect(() => {
    doFetch()
    return () => {
      requestIdRef.current += 1
    }
  }, [doFetch])
  const retry = useCallback(() => {
    fetchCache.delete(key)
    doFetch(true)
  }, [doFetch, key])
  const refresh = useCallback(() => {
    doFetch(true)
  }, [doFetch])
  const current = enabled && state.key === key
  return {
    data: current ? state.data : null,
    loading: enabled && (!current || state.loading),
    error: current ? state.error : null,
    status: current ? state.status : null,
    fetchedAt: current ? state.fetchedAt : null,
    retry,
    refresh
  }
}

export function fmt(n: number | null | undefined, decimals = 1): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(decimals)}B`
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(decimals)}M`
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(decimals)}K`
  return `$${Math.abs(n) < 0.5 ? '0' : n.toFixed(0)}`
}

export function pct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

export function bpsPct(bps: number | null | undefined): string {
  if (bps == null || !Number.isFinite(bps)) return '—'
  return `${(bps / 100).toFixed(1)}%`
}

export function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function powergloveVaultPath(chainId: number, address: string): string {
  return `/vaults/${chainId}/${address}`
}

export function pctFmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${(n * 100).toFixed(2)}%`
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  137: 'Polygon',
  250: 'Fantom',
  999: 'HyperEVM',
  42161: 'Arbitrum',
  8453: 'Base',
  100: 'Gnosis',
  747474: 'Katana',
  80094: 'Berachain',
  146: 'Sonic'
}

export const CHAIN_SHORT: Record<number, string> = {
  1: 'ETH',
  10: 'OP',
  137: 'POLY',
  250: 'FTM',
  999: 'HYPE',
  42161: 'ARB',
  8453: 'BASE',
  100: 'GNO',
  747474: 'KAT',
  80094: 'BERA',
  146: 'SONIC'
}

export const CHAIN_COLORS: Record<number, string> = {
  1: '#627eea',
  10: '#ff0420',
  137: '#8247e5',
  250: '#1969ff',
  42161: '#28a0f0',
  8453: '#0052ff',
  100: '#04795b',
  747474: '#f5a623',
  80094: '#d4a574',
  146: '#5b21b6'
}

export const CAT_COLORS: Record<string, string> = {
  v1: '#808080',
  v2: '#46a2ff',
  v3: '#16a34a',
  curation: '#a16207'
}

export const CHART_COLORS = [
  '#0657f9',
  '#46a2ff',
  '#94adf2',
  '#16a34a',
  '#a16207',
  '#7f1d1d',
  '#808080',
  '#4f4f4f',
  '#b8c7f5',
  '#c6d9ff'
]

export function useSort(defaultKey: string, defaultDir: 'asc' | 'desc' = 'desc') {
  const [sortKey, setSortKey] = useState(defaultKey)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultDir)

  const handleSort = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((dir) => (dir === 'desc' ? 'asc' : 'desc'))
        return prev
      }
      setSortDir('desc')
      return key
    })
  }, [])

  const sorted = useCallback(
    <T,>(items: T[], accessors: Record<string, (item: T) => number | string>): T[] => {
      const accessor = accessors[sortKey]
      if (!accessor) return items
      const direction = sortDir === 'desc' ? -1 : 1
      return [...items].sort((a, b) => {
        const aVal = accessor(a)
        const bVal = accessor(b)
        if (typeof aVal === 'string' && typeof bVal === 'string') return aVal.localeCompare(bVal) * direction
        return ((aVal as number) - (bVal as number)) * direction
      })
    },
    [sortDir, sortKey]
  )

  const th = useCallback(
    (key: string, label: string, className?: string) => ({
      className: `sortable ${className || ''}`.trim(),
      onClick: () => handleSort(key),
      role: 'columnheader' as const,
      'aria-sort': (sortKey === key ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none') as
        | 'ascending'
        | 'descending'
        | 'none',
      tabIndex: 0,
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleSort(key)
        }
      },
      children: `${label}${sortKey === key ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ''}`
    }),
    [handleSort, sortDir, sortKey]
  )

  return { sortKey, sortDir, handleSort, sorted, th }
}

export function useDebouncedValue<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [delay, value])
  return debounced
}

export function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvEscape = (value: string | number) => {
    const stringValue = String(value)
    return stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')
      ? `"${stringValue.replace(/"/g, '""')}"`
      : stringValue
  }

  const csv = [headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}

export function SkeletonCards({ count = 5 }: { count?: number }) {
  const skeletonIds = Array.from({ length: count }, (_, index) => `skeleton-card-${index}`)

  return (
    <div className="skeleton-grid">
      {skeletonIds.map((id) => (
        <div key={id} className="skeleton-card">
          <div className="skeleton skeleton-line" style={{ width: '40%' }} />
          <div className="skeleton skeleton-line-lg" />
          <div className="skeleton skeleton-line-sm" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonChart() {
  return (
    <div className="card">
      <div className="skeleton skeleton-line" style={{ width: '30%', marginBottom: '1rem' }} />
      <div className="skeleton skeleton-chart" />
    </div>
  )
}

export function usePagination(totalItems: number, pageSize = 30) {
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(totalItems / pageSize)
  const start = page * pageSize
  const end = start + pageSize

  useEffect(() => {
    if (page >= totalPages && totalPages > 0) setPage(totalPages - 1)
  }, [page, totalPages])

  const Pagination =
    totalPages <= 1
      ? null
      : () => (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              marginTop: '0.75rem'
            }}
          >
            <button className="page-btn" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>
              Prev
            </button>
            <span className="text-dim" style={{ fontSize: '0.78rem' }}>
              {start + 1}–{Math.min(end, totalItems)} of {totalItems}
            </span>
            <button
              className="page-btn"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        )

  return { page, start, end, totalPages, setPage, Pagination }
}
