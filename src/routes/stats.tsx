import { createFileRoute } from '@tanstack/react-router'
import { NativeStatsDashboard } from '@/components/landing/native-stats/NativeStatsDashboard'
import { parseStatsSearch, type StatsTab } from '@/components/landing/native-stats/stats-navigation'

function StatsPage() {
  const { tab = 'overview' } = Route.useSearch()
  const navigate = Route.useNavigate()

  const handleTabChange = (nextTab: StatsTab) => {
    void navigate({
      search: (previous) => ({ ...previous, tab: nextTab })
    })
  }

  return (
    <main className="flex-1 container pt-0 pb-0">
      <NativeStatsDashboard tab={tab} onTabChange={handleTabChange} />
    </main>
  )
}

export const Route = createFileRoute('/stats')({
  validateSearch: parseStatsSearch,
  component: StatsPage
})
