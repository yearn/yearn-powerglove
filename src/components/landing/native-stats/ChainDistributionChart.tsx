import { Cell, Label, Pie, PieChart, Tooltip } from 'recharts'
import { fmt } from './hooks'

export function ChainDistributionChart({
  chains,
  colors,
  total
}: {
  chains: Array<{ chain: string; label: string; tvl: number }>
  colors: string[]
  total: number
}) {
  return (
    <div role="img" aria-label="TVL distribution by chain" className="chain-distribution-donut">
      <PieChart width={280} height={280}>
        <Pie
          data={chains.filter((chain) => chain.tvl > 0)}
          dataKey="tvl"
          nameKey="label"
          cx={140}
          cy={140}
          innerRadius={90}
          outerRadius={128}
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
          <Label value="TVL %" position="center" fill="var(--text)" fontSize={14} />
        </Pie>
        <Tooltip
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
    </div>
  )
}
