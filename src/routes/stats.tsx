import { createFileRoute, Navigate } from '@tanstack/react-router'
import { NativeStatsDashboard } from '@/components/landing/native-stats/NativeStatsDashboard'
import { parseStatsSearch } from '@/components/landing/native-stats/stats-navigation'

function StatsPage() {
  const { tab, preview } = Route.useSearch()
  if (tab === 'analysis') return <Navigate to="/stats/analysis" search={{ preview }} replace />
  return (
    <main className="flex-1 container pt-0 pb-0">
      <NativeStatsDashboard />
    </main>
  )
}

export const Route = createFileRoute('/stats')({
  validateSearch: parseStatsSearch,
  component: StatsPage
})
