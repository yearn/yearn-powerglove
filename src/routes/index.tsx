import { createFileRoute } from '@tanstack/react-router'
import AllVaultsPage from '@/routes/vaults/index'

export const Route = createFileRoute('/')({
  component: AllVaultsPage
})
