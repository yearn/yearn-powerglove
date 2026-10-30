import { createFileRoute } from '@tanstack/react-router'
import { NativeStatsDashboard } from '@/components/landing/native-stats/NativeStatsDashboard'

export const Route = createFileRoute('/stats_/analysis')({
  validateSearch: (search: Record<string, unknown>): { preview?: string } =>
    typeof search.preview === 'string' ? { preview: search.preview } : {},
  component: () => (
    <div className="w-full min-w-0 flex-1">
      <NativeStatsDashboard analysis />
    </div>
  )
})
