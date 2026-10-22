import { createFileRoute } from '@tanstack/react-router'
import { NativeStatsDashboard } from '@/components/landing/native-stats/NativeStatsDashboard'

export const Route = createFileRoute('/stats_/analysis')({
  validateSearch: (search: Record<string, unknown>): { preview?: string } =>
    typeof search.preview === 'string' ? { preview: search.preview } : {},
  component: () => (
    <main className="flex-1 container pt-0 pb-0">
      <NativeStatsDashboard analysis />
    </main>
  )
})
