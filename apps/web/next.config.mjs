import { baseNextConfig } from '../../packages/web-shared/next/base-config.mjs'
import { siteUrls } from '../../packages/web-shared/next/site-urls.mjs'

const urls = siteUrls()

const moved = (sources, origin) =>
  sources.map((source) => ({ source, destination: `${origin}${source}`, permanent: true }))

/** @type {import('next').NextConfig} */
const config = {
  ...baseNextConfig(),
  redirects() {
    return Promise.resolve([
      { source: '/customers', destination: '/use-cases', permanent: true },
      ...moved(
        ['/login', '/signup', '/onboarding', '/callback', '/app', '/app/:path*'],
        urls.dashboard,
      ),
      ...moved(['/admin', '/admin/:path*'], urls.admin),
      ...moved(['/pay/:path*', '/sub/:path*', '/store/:path*'], urls.checkout),
      ...moved(['/docs', '/docs/:path*'], urls.docs),
    ])
  },
}

export default config
