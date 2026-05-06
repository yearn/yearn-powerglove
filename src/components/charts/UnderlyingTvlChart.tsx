import React, { useMemo } from 'react'
import { Bar, CartesianGrid, ComposedChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { getTimeframeLimit } from '@/components/charts/chart-utils'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { useIsMobile } from '@/components/ui/use-mobile'
import { formatTokenDisplay } from '@/lib/formatters'
import type { ChartDataPoint } from '@/types/dataTypes'

interface UnderlyingTvlChartProps {
  chartData: ChartDataPoint[]
  timeframe: string
  assetSymbol?: string
}

const buildTooltipValue = (assetSymbol?: string) => (value: number) => {
  const formatted = formatTokenDisplay(value)
  return assetSymbol ? `${formatted} ${assetSymbol}` : formatted
}

export const UnderlyingTvlChart: React.FC<UnderlyingTvlChartProps> = React.memo(({ chartData, timeframe, assetSymbol }) => {
  const isMobile = useIsMobile()
  const filteredData = useMemo(() => chartData.slice(-getTimeframeLimit(timeframe)), [chartData, timeframe])

  return (
    <ChartContainer
      config={{
        value: { label: assetSymbol ? `Underlying TVL (${assetSymbol})` : 'Underlying TVL', color: 'var(--chart-1)' }
      }}
      style={{ height: '100%' }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={filteredData}
          margin={{
            top: 12,
            right: isMobile ? 8 : 20,
            left: isMobile ? -18 : 0,
            bottom: isMobile ? 12 : 16
          }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            minTickGap={isMobile ? 32 : 24}
            tick={{
              fill: 'hsl(var(--muted-foreground))',
              fontSize: isMobile ? 11 : 12
            }}
            axisLine={{ stroke: 'hsl(var(--muted-foreground))' }}
            tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis
            width={isMobile ? 56 : 84}
            domain={[0, 'auto']}
            tickFormatter={(value) => formatTokenDisplay(value)}
            label={
              isMobile
                ? undefined
                : {
                    value: assetSymbol ? `Underlying TVL (${assetSymbol})` : 'Underlying TVL',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 10,
                    style: {
                      textAnchor: 'middle',
                      fill: 'hsl(var(--muted-foreground))'
                    }
                  }
            }
            tick={{
              fill: 'hsl(var(--muted-foreground))',
              fontSize: isMobile ? 11 : 12
            }}
            axisLine={{ stroke: 'hsl(var(--muted-foreground))' }}
            tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
          />
          <ChartTooltip formatter={buildTooltipValue(assetSymbol)} />
          <Bar dataKey="TVL" fill="var(--color-value)" stroke="transparent" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
})

export default UnderlyingTvlChart
