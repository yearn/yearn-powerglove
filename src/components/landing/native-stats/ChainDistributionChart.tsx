import { Cell, Label, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useIsMobile } from '@/components/ui/use-mobile'
import { fmt } from './hooks'
import { StatsTooltipContent, useMobileChartTooltip } from './StatsChartInteractions'

export function ChainDistributionChart({
  chains,
  colors,
  total
}: {
  chains: Array<{ chain: string; label: string; tvl: number }>
  colors: string[]
  total: number
}) {
  const mobile = useIsMobile()
  const tooltip = useMobileChartTooltip(mobile)
  return (
    <div role="img" aria-label="TVL distribution by chain" className="chain-distribution-donut">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart {...tooltip.chartEvents}>
          <Pie
            data={chains.filter((chain) => chain.tvl > 0)}
            dataKey="tvl"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius="64%"
            outerRadius="92%"
            paddingAngle={3}
            startAngle={90}
            endAngle={-270}
            stroke="var(--surface)"
            isAnimationActive={false}
          >
            {chains
              .filter((chain) => chain.tvl > 0)
              .map((chain) => (
                <Cell key={chain.chain} fill={colors[chains.indexOf(chain) % colors.length]} />
              ))}
            <Label value="TVL % by Chain" position="center" fill="var(--text)" fontSize={14} />
          </Pie>
          <Tooltip
            content={<StatsTooltipContent mobile={mobile} onClose={tooltip.dismiss} />}
            {...tooltip.tooltipProps}
            formatter={(value: number, name: string) => [
              `${fmt(value)} · ${total > 0 ? ((value / total) * 100).toFixed(2) : '0.00'}%`,
              name
            ]}
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              fontSize: 12,
              borderRadius: 0
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
