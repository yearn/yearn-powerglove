import React, { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { getTimeframeLimit } from '@/components/charts/chart-utils'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { useIsMobile } from '@/components/ui/use-mobile'
import type { ChartDataPoint } from '@/types/dataTypes'

type PercentSeriesKey = 'derivedApr'

interface PPSChartProps {
  chartData: ChartDataPoint[]
  timeframe: string
  hideAxes?: boolean
  hideTooltip?: boolean
  dataKey?: 'PPS' | PercentSeriesKey
}

export const PPSChart: React.FC<PPSChartProps> = React.memo(
  ({ chartData, timeframe, hideAxes, hideTooltip, dataKey = 'PPS' }) => {
    const isMobile = useIsMobile()
    const filteredData = useMemo(() => chartData.slice(-getTimeframeLimit(timeframe)), [chartData, timeframe])

    const isPercentSeries = dataKey !== 'PPS'
    const percentSeriesMeta: Record<PercentSeriesKey, { label: string; color: string }> = {
      derivedApr: {
        label: 'Derived APR %',
        color: 'var(--chart-4)'
      }
    }
    const activePercentMeta = dataKey !== 'PPS' ? percentSeriesMeta[dataKey as PercentSeriesKey] : undefined

    return (
      <ChartContainer
        config={
          isPercentSeries && activePercentMeta
            ? {
                [dataKey]: {
                  label: activePercentMeta.label,
                  color: hideAxes ? 'black' : activePercentMeta.color
                }
              }
            : {
                pps: {
                  label: 'Price Per Share',
                  color: hideAxes ? 'black' : 'var(--chart-1)'
                }
              }
        }
        style={{ height: '100%' }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={filteredData}
            margin={{
              top: 12,
              right: isMobile ? 8 : 20,
              left: isMobile ? -20 : 0,
              bottom: hideAxes ? 8 : isMobile ? 12 : 16
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              minTickGap={isMobile ? 32 : 24}
              tick={
                hideAxes
                  ? false
                  : {
                      fill: 'hsl(var(--muted-foreground))',
                      fontSize: isMobile ? 11 : 12
                    }
              }
              axisLine={hideAxes ? false : { stroke: 'hsl(var(--muted-foreground))' }}
              tickLine={hideAxes ? false : { stroke: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              width={isMobile ? 44 : 60}
              domain={isPercentSeries ? [0, 'auto'] : ['auto', 'auto']}
              tickFormatter={(value) => (isPercentSeries ? `${value}%` : Number(value).toFixed(3))}
              label={
                hideAxes || isMobile
                  ? undefined
                  : {
                      value: isPercentSeries && activePercentMeta ? activePercentMeta.label : 'Price Per Share',
                      angle: -90,
                      position: 'insideLeft',
                      offset: 10,
                      style: {
                        textAnchor: 'middle',
                        fill: hideAxes ? 'transparent' : 'hsl(var(--muted-foreground))'
                      }
                    }
              }
              tick={
                hideAxes
                  ? false
                  : {
                      fill: 'hsl(var(--muted-foreground))',
                      fontSize: isMobile ? 11 : 12
                    }
              }
              axisLine={hideAxes ? false : { stroke: 'hsl(var(--muted-foreground))' }}
              tickLine={hideAxes ? false : { stroke: 'hsl(var(--muted-foreground))' }}
            />
            {!hideTooltip && (
              <ChartTooltip
                formatter={(value: number) =>
                  isPercentSeries && activePercentMeta
                    ? [`${value.toFixed(2)}%`, activePercentMeta.label]
                    : [value.toFixed(3), 'PPS']
                }
              />
            )}

            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={isPercentSeries ? `var(--color-${dataKey})` : 'var(--color-pps)'}
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

export default PPSChart
