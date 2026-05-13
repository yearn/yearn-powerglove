import { createFileRoute } from '@tanstack/react-router'
import { TvlFlowGraphTool } from '@/components/landing/native-stats/TvlFlowGraphTool'

export const Route = createFileRoute('/tvl-flow')({
  component: TvlFlowGraphTool
})
