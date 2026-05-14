import { createFileRoute } from '@tanstack/react-router'

function DisclaimerPage() {
  return (
    <div className="flex min-h-full w-full flex-1 overflow-y-auto">
      <div className="min-h-full w-full border-x border-border bg-white px-[4.5rem] py-8 sm:px-[7.5rem] lg:px-48 xl:px-60">
        <div className="">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Disclaimer</h1>

          <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
            <div className="p-6 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg mb-8">
              <p className="text-yellow-800 font-semibold">
                <strong>Important Notice:</strong> This information is provided for educational and informational
                purposes only.
              </p>
            </div>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Not Financial Advice</h2>
            <p className="leading-relaxed">
              The information displayed on this dashboard does not constitute financial, investment, trading, or other
              advice. All data is provided as-is for informational purposes only.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Use at Your Own Risk</h2>
            <p className="leading-relaxed">
              DeFi protocols and cryptocurrency investments carry risks, including but not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Complete loss of invested capital</li>
              <li>Smart contract vulnerabilities and exploits</li>
              <li>Regulatory changes and compliance risks</li>
              <li>Market volatility and impermanent loss</li>
              <li>Technical failures and network outages</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Data Accuracy</h2>
            <p className="leading-relaxed">
              While we strive to provide accurate and up-to-date information about Yearn vaults, we make no warranties
              or guarantees regarding the accuracy, completeness, or reliability of the data. Metrics such as APY, TVL,
              and strategy information are best-effort representations and may not reflect real-time conditions.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">No Transaction Capabilities</h2>
            <p className="leading-relaxed">
              This dashboard is for informational purposes only and does not provide direct deposit, withdrawal, or
              trading functionality. Any links to external platforms are provided for convenience and do not constitute
              an endorsement of those services.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">External Links and Third Parties</h2>
            <p className="leading-relaxed">
              Links to external websites, including yearn.fi and other DeFi platforms, are provided for convenience. We
              are not responsible for the content, accuracy, or practices of these external sites.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
export const Route = createFileRoute('/disclaimer')({
  component: DisclaimerPage
})
