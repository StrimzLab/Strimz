import { baseNextConfig } from '../../packages/web-shared/next/base-config.mjs'

/** @type {import('next').NextConfig} */
const config = {
  ...baseNextConfig({ browserOnly: ['@privy-io/react-auth'] }),
  redirects() {
    return Promise.resolve([{ source: '/', destination: '/admin', permanent: false }])
  },
}

export default config
