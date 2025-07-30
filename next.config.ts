// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true, // Lar deg bygge selv med typefeil (f.eks. bruk av any)
  },
  eslint: {
    ignoreDuringBuilds: true, // Lar deg bygge selv med ESLint-feil (f.eks. next/image-advarsel)
  },
  // Hvis du bruker appDir/app-router (default nå):
  experimental: {
    appDir: true,
  },
}

export default nextConfig
