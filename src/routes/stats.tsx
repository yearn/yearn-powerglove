import { createFileRoute } from '@tanstack/react-router'
import { NativeStatsDashboard } from '@/components/landing/native-stats/NativeStatsDashboard'

function StatsPage() {
  return (
    <main className="flex-1 container pt-0 pb-0">
      <NativeStatsDashboard />
    </main>
  )
}

export const Route = createFileRoute('/stats')({
  component: StatsPage
})
