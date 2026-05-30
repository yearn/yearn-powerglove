import React, { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { getTimeframeLimit } from '@/components/charts/chart-utils'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { useIsMobile } from '@/components/ui/use-mobile'
import type { yvUsdChartData } from '@/types/dataTypes'

type YvUsdChartValue = 'apy' | 'pps' | 'tvl'

interface YvUsdDualLineChartProps {
  chartData: yvUsdChartData
  timeframe: string
  valueType: YvUsdChartValue
}

const formatAxisValue = (value: number, valueType: YvUsdChartValue): string => {
  if (valueType === 'apy') {
    return `${value.toFixed(1)}%`
  }

  if (valueType === 'tvl') {
    return `$${(value / 1_000_000).toFixed(1)}M`
  }

  return value.toFixed(3)
}

const formatTooltipValue = (valueType: YvUsdChartValue) => {
  return (value: number, name: string) => {
    const label = name === 'locked' ? 'Locked yvUSD' : 'Unlocked yvUSD'

    if (valueType === 'apy') {
      return [`${value.toFixed(2)}%`, label]
    }

    if (valueType === 'tvl') {
      return [`$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, label]
    }

    return [value.toFixed(4), label]
  }
}

const yAxisLabel = (valueType: YvUsdChartValue): string => {
  if (valueType === 'apy') {
    return 'APY'
  }

  if (valueType === 'tvl') {
    return 'TVL ($ millions)'
  }

  return 'Price Per Share'
}

export const YvUsdDualLineChart: React.FC<YvUsdDualLineChartProps> = React.memo(
  ({ chartData, timeframe, valueType }) => {
    const isMobile = useIsMobile()
    const filteredData = useMemo(() => chartData.slice(-getTimeframeLimit(timeframe)), [chartData, timeframe])
    const chartBottomPadding = isMobile ? 12 : 16
    const yAxisMargin = isMobile ? 52 : valueType === 'tvl' ? 68 : 60

    return (
      <ChartContainer
        config={{
          unlocked: {
            label: 'Unlocked yvUSD',
            color: 'var(--chart-1)'
          },
          locked: {
            label: 'Locked yvUSD',
            color: valueType === 'tvl' ? '#ff6ba5' : '#ff8fbb'
          }
        }}
        style={{ height: '100%' }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={filteredData}
            margin={{
              top: 12,
              right: isMobile ? 8 : 20,
              left: isMobile ? -18 : 0,
              bottom: chartBottomPadding
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
              width={yAxisMargin}
              domain={valueType === 'tvl' ? [0, 'auto'] : ['auto', 'auto']}
              tickFormatter={(value) => formatAxisValue(Number(value), valueType)}
              label={
                isMobile
                  ? undefined
                  : {
                      value: yAxisLabel(valueType),
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
            <ChartTooltip formatter={formatTooltipValue(valueType)} />
            <Line
              type="monotone"
              dataKey="unlocked"
              name="unlocked"
              stroke="var(--color-unlocked)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="locked"
              name="locked"
              stroke="var(--color-locked)"
              strokeDasharray="5 4"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    )
  }
)

export default YvUsdDualLineChart
