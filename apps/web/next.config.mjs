import { createMDX } from 'fumadocs-mdx/next'

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Lets us import packages from the workspace without pre-build steps.
    typedRoutes: false,
  },
  transpilePackages: [
    '@strimz/ui',
    '@strimz/sdk',
    '@strimz/sdk-react',
    '@strimz/shared-types',
    '@strimz/shared-config',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
}

export default withMDX(config)
