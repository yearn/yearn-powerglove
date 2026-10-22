import { createFileRoute, Navigate } from '@tanstack/react-router'
import { NativeStatsDashboard } from '@/components/landing/native-stats/NativeStatsDashboard'
import { parseStatsSearch } from '@/components/landing/native-stats/stats-navigation'

function StatsPage() {
  const { tab, preview } = Route.useSearch()
  if (tab === 'analysis') return <Navigate to="/stats/analysis" search={{ preview }} replace />
  return (
    <main className="w-full min-w-0 flex-1">
      <NativeStatsDashboard />
    </main>
  )
}

export const Route = createFileRoute('/')({
  validateSearch: parseStatsSearch,
  component: StatsPage
})
