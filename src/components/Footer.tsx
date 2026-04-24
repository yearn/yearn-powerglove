import { ExternalLink } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="mt-auto bg-[#f5f5f5]">
      <div className="mx-auto w-full max-w-[1400px] border-x border-border bg-white px-4 py-4 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex items-center justify-center">
            <img src="/logo.svg" alt="Yearn PowerGlove Logo" className="w-6 h-6" />
            <span className="ml-2 text-lg font-bold text-accent">Yearn</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:gap-6">
            <a
              href="https://docs.yearn.fi"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-sm text-gray-500 hover:text-gray-700"
            >
              Docs <ExternalLink className="ml-1 h-3 w-3" />
            </a>

            <a href="/about" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-gray-700">
              About Yearn
            </a>

            <a href="/privacy" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-gray-700">
              Privacy Policy
            </a>
            <a href="/disclaimer" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-gray-700">
              Disclaimer
            </a>
          </div>

          <div className="flex items-center justify-center gap-4">
            <a
              href="https://x.com/yearnfi/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-700"
            >
              <img src="/twitter-x.svg" alt="X (formerly Twitter)" className="h-5 w-5" />
            </a>
            <a
              href="https://yearn.fi"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-700"
            >
              <img src="/yearn-link-icon.svg" alt="Yearn.fi" className="h-5 w-5" />
            </a>
            <a
              href="https://github.com/yearn"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-700"
            >
              <img src="/github-icon.svg" alt="GitHub" className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
