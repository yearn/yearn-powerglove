import { createFileRoute } from '@tanstack/react-router'
import { TranchedVaultMockup } from '@/routes/mockups/tranched-vault'

export const Route = createFileRoute('/mockups/equity-yvusd')({
  component: () => <TranchedVaultMockup tranche="equity" />
})
