import { baseNextConfig } from '../../packages/web-shared/next/base-config.mjs'
import { siteUrls } from '../../packages/web-shared/next/site-urls.mjs'

/** @type {import('next').NextConfig} */
const config = {
  // Merchants embed checkout in their own pages.
  ...baseNextConfig({ frameAncestors: '*' }),
  redirects() {
    return Promise.resolve([{ source: '/', destination: siteUrls().site, permanent: false }])
  },
}

export default config
