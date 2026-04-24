import type React from 'react'
import { FixedHeightChartContainer } from '@/components/charts/chart-container'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const ChartSkeleton: React.FC = () => {
  // Define timeframe options to match the real component
  const timeframes = [
    { label: '30 Days', value: '30d' },
    { label: '90 Days', value: '90d' },
    { label: '1 Year', value: '1y' },
    { label: 'All Time', value: 'all' }
  ]

  return (
    <div className="border-x border-t border-border bg-white">
      <Tabs defaultValue="historical-apy" className="w-full">
        <div className="border-b border-border">
          <div className="px-4 pt-4 sm:px-6">
            <TabsList className="grid w-full grid-cols-3 bg-transparent p-0">
              <TabsTrigger
                value="historical-apy"
                className="rounded-none border border-border px-2 py-3 text-xs data-[state=active]:border-[#0657f9] data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:border-x-0 sm:border-t-0 sm:border-b-2 sm:px-4 sm:text-sm"
              >
                Performance
              </TabsTrigger>
              <TabsTrigger
                value="historical-pps"
                className="rounded-none border border-border px-2 py-3 text-xs data-[state=active]:border-[#0657f9] data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:border-x-0 sm:border-t-0 sm:border-b-2 sm:px-4 sm:text-sm"
              >
                Share Growth
              </TabsTrigger>
              <TabsTrigger
                value="historical-tvl"
                className="rounded-none border border-border px-2 py-3 text-xs data-[state=active]:border-[#0657f9] data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:border-x-0 sm:border-t-0 sm:border-b-2 sm:px-4 sm:text-sm"
              >
                TVL
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="h-4 bg-gray-200 rounded w-64 mb-2 animate-pulse"></div>
              <div className="h-3 bg-gray-200 rounded w-80 animate-pulse"></div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <div className="h-10 rounded-md bg-gray-200 animate-pulse"></div>
              <div className="h-10 rounded-md bg-gray-200 animate-pulse"></div>
              <div className="hidden sm:contents">
                {timeframes.map((tf) => (
                  <div key={tf.value} className="h-7 w-16 rounded bg-gray-200 animate-pulse"></div>
                ))}
              </div>
            </div>
          </div>

          <TabsContent value="historical-apy" className="mt-0">
            <FixedHeightChartContainer>
              <SkeletonChart />
            </FixedHeightChartContainer>
          </TabsContent>

          <TabsContent value="historical-pps" className="mt-0">
            <FixedHeightChartContainer>
              <SkeletonChart />
            </FixedHeightChartContainer>
          </TabsContent>

          <TabsContent value="historical-tvl" className="mt-0">
            <FixedHeightChartContainer>
              <SkeletonChart />
            </FixedHeightChartContainer>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

// Individual skeleton chart component
const SkeletonChart: React.FC = () => {
  const yAxisTicks = Array.from({ length: 5 }, (_, index) => `y-axis-${index}`)
  const xAxisTicks = Array.from({ length: 6 }, (_, index) => `x-axis-${index}`)

  return (
    <div className="w-full h-full flex flex-col min-h-[400px]">
      {/* Y-axis labels skeleton */}
      <div className="flex flex-1">
        <div className="w-12 flex flex-col justify-between py-4 pl-4">
          {yAxisTicks.map((tick) => (
            <div key={tick} className="h-2 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>

        {/* Chart area skeleton */}
        <div className="flex-1 relative min-h-[300px]"></div>
      </div>

      {/* X-axis labels skeleton */}
      <div className="flex justify-around pl-4 mt-2 ml-12 flex-shrink-0">
        {xAxisTicks.map((tick) => (
          <div key={tick} className="h-2 bg-gray-200 rounded w-8 animate-pulse"></div>
        ))}
      </div>
    </div>
  )
}

export default ChartSkeleton
