import { createFileRoute, Navigate } from '@tanstack/react-router'
import { NativeStatsDashboard } from '@/components/landing/native-stats/NativeStatsDashboard'
import { parseStatsSearch } from '@/components/landing/native-stats/stats-navigation'

function StatsPage() {
  const { tab, preview } = Route.useSearch()
  if (tab === 'analysis') return <Navigate to="/stats/analysis" search={{ preview }} replace />
  return (
    <div className="w-full min-w-0 flex-1">
      <NativeStatsDashboard />
    </div>
  )
}

export const Route = createFileRoute('/')({
  validateSearch: parseStatsSearch,
  component: StatsPage
})
