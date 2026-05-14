import { createFileRoute } from '@tanstack/react-router'

function AboutPage() {
  return (
    <div className="flex min-h-full w-full flex-1 overflow-y-auto">
      <div className="min-h-full w-full border-x border-border bg-white px-[4.5rem] py-8 sm:px-[7.5rem] lg:px-48 xl:px-60">
        <div className="">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">About Yearn</h1>

          <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
            <p className="leading-relaxed">
              Yearn is a decentralized finance (DeFi) protocol, operating on Ethereum, that automates yield generation
              strategies across various DeFi platforms. Founded in 2020, Yearn is one of the most trusted and innovative
              protocols in the DeFi ecosystem.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">What Yearn Does</h2>
            <p className="leading-relaxed">
              Yearn's Vaults are smart contracts that automatically allocate deposited funds to the best yield
              opportunities available. Our strategies are designed and maintained by experienced DeFi strategists who
              continuously optimize for the best risk-adjusted returns.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Key Features</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Automated yield optimization strategies</li>
              <li>Gas-efficient vault operations</li>
              <li>Always self-custodial</li>
              <li>Transparent and audited smart contracts</li>
              <li>Cross-chain deployment on multiple networks</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">About This Dashboard</h2>
            <p className="leading-relaxed">
              The PowerGlove dashboard provides real-time metrics and insights into Yearn's vault performance, including
              APY tracking, TVL analysis, and strategy breakdowns. It's designed to help users make informed decisions
              about their DeFi investments. For more information, please review our{' '}
              <a href="/disclaimer" className="underline text-blue-600 hover:text-blue-800">
                disclaimer.
              </a>
            </p>

            <div className="mt-8 p-6 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
              <p className="text-md text-blue-800">
                <strong>Learn More:</strong> For detailed documentation and guides, visit{' '}
                <a
                  href="https://docs.yearn.fi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-blue-600"
                >
                  docs.yearn.fi
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
export const Route = createFileRoute('/about')({
  component: AboutPage
})
