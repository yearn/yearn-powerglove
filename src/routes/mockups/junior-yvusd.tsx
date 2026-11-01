import { createFileRoute } from '@tanstack/react-router'
import { TranchedVaultMockup } from '@/routes/mockups/tranched-vault'

export const Route = createFileRoute('/mockups/junior-yvusd')({
  component: () => <TranchedVaultMockup junior />
})
