import { createFileRoute, redirect } from '@tanstack/react-router'
import { parseStatsSearch } from '@/components/landing/native-stats/stats-navigation'

export const Route = createFileRoute('/stats')({
  validateSearch: parseStatsSearch,
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/', search, replace: true })
  }
})
