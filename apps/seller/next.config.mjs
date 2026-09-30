/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@nearbuy/ui', '@nearbuy/api', '@nearbuy/config', '@nearbuy/types', '@nearbuy/validation'],
  async rewrites() {
    const api = process.env.API_URL ?? 'http://127.0.0.1:4000'
    return [
      { source: '/api/:path*', destination: `${api}/api/:path*` },
      { source: '/health', destination: `${api}/health` },
    ]
  },
}
export default nextConfig
