import { createFileRoute } from '@tanstack/react-router'

function PrivacyPage() {
  return (
    <div className="flex min-h-full w-full flex-1 overflow-y-auto">
      <div className="min-h-full w-full border-x border-border bg-white px-[4.5rem] py-8 sm:px-[7.5rem] lg:px-48 xl:px-60">
        <div className="">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>

          <div className="prose prose-gray max-w-none space-y-6 text-gray-700 text-sm">
            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Information We Collect</h2>
            <p>
              This dashboard is a read-only interface that displays publicly available information about Yearn Finance
              vaults. We do not collect personal information, store user data, or track individual user activities.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Data Sources</h2>
            <p>
              All vault metrics, performance data, and strategy information displayed on this site are retrieved from
              public blockchain data and Yearn's official APIs. No private or sensitive information is accessed or
              processed.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Third-Party Services</h2>
            <p>This site may use third-party services for:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Web hosting and content delivery</li>
              <li>Analytics (if implemented, anonymized only)</li>
              <li>API services for blockchain data</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Cookies and Local Storage</h2>
            <p>
              This site may use minimal local storage for user preferences (such as theme settings) but does not use
              tracking cookies or store personal information.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">External Links</h2>
            <p>
              This site contains links to external websites including yearn.fi and documentation pages. We are not
              responsible for the privacy practices of these external sites.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Changes to This Policy</h2>
            <p>
              This privacy policy may be updated from time to time. Any changes will be reflected by updating the "Last
              updated" date at the top of this page.
            </p>

            <div className="mt-8 p-6 bg-gray-50 border-l-4 border-gray-400 rounded-r-lg">
              <p className="text-sm text-gray-700">
                <strong>Contact:</strong> For questions about this privacy policy, please refer to the official Yearn
                Finance community channels or documentation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
export const Route = createFileRoute('/privacy')({
  component: PrivacyPage
})
