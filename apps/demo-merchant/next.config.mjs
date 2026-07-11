/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@strimz/sdk', '@strimz/sdk-react'],
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
