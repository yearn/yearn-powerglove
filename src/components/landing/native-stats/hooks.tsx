import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'

export function resolveStatsApiBase(): string | null {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    if (hostname === '127.0.0.1' || hostname === 'localhost' || hostname.endsWith('.ts.net')) {
      return ''
    }
  }

  const configuredUrl = import.meta.env.VITE_PUBLIC_YEARN_METRICS_API_URL?.trim()

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '')
  }

  return null
}

const resolvedStatsApiBase = resolveStatsApiBase()

export const API_BASE = resolvedStatsApiBase ?? ''
export const HAS_STATS_API = resolvedStatsApiBase !== null

const fetchCache = new Map<string, { data: unknown; timestamp: number }>()
const inFlightFetches = new Map<string, Promise<{ payload: unknown; timestamp: number }>>()
const CACHE_TTL = 5 * 60 * 1000

export function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(() => {
    const cached = fetchCache.get(url)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data as T
    return null
  })
  const [loading, setLoading] = useState(() => {
    const cached = fetchCache.get(url)
    return !(cached && Date.now() - cached.timestamp < CACHE_TTL)
  })
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(() => {
    const cached = fetchCache.get(url)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.timestamp
    return null
  })
  const requestIdRef = useRef(0)

  const doFetch = useCallback(
    (bypassCache = false) => {
      requestIdRef.current += 1
      const requestId = requestIdRef.current

      if (!bypassCache) {
        const cached = fetchCache.get(url)
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          setData(cached.data as T)
          setFetchedAt(cached.timestamp)
          setLoading(false)
          setError(null)
          return
        }
      }

      setLoading(true)

      const request =
        !bypassCache && inFlightFetches.has(url)
          ? inFlightFetches.get(url)!
          : (() => {
              const fetchPromise = fetch(`${API_BASE}${url}`)
                .then((response) => {
                  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
                  return response.json()
                })
                .then((payload) => {
                  const now = Date.now()
                  fetchCache.set(url, { data: payload, timestamp: now })
                  return { payload, timestamp: now }
                })
                .finally(() => {
                  inFlightFetches.delete(url)
                })

              inFlightFetches.set(url, fetchPromise)
              return fetchPromise
            })()

      request
        .then(({ payload, timestamp }) => {
          if (requestId !== requestIdRef.current) return
          setData(payload as T)
          setFetchedAt(timestamp)
          setError(null)
        })
        .catch((err: Error) => {
          if (requestId !== requestIdRef.current) return
          setError(err.message)
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setLoading(false)
        })
    },
    [url]
  )

  useEffect(() => {
    doFetch()
    return () => {
      requestIdRef.current += 1
    }
  }, [doFetch])

  const retry = useCallback(() => {
    fetchCache.delete(url)
    setError(null)
    doFetch(true)
  }, [doFetch, url])

  const refresh = useCallback(() => {
    doFetch(true)
  }, [doFetch])

  return { data, loading, error, fetchedAt, retry, refresh }
}

export function fmt(n: number, decimals = 1): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(decimals)}B`
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(decimals)}M`
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(decimals)}K`
  return `$${Math.abs(n) < 0.5 ? '0' : n.toFixed(0)}`
}

export function pct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

export function bpsPct(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`
}

export function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function powergloveVaultPath(chainId: number, address: string): string {
  return `/vaults/${chainId}/${address}`
}

export function pctFmt(n: number): string {
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
