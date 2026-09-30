/**
 * Next.js configuration for Vellee Luxe.
 *
 * Note: Next.js 14 only supports `next.config.js` / `next.config.mjs`.
 * (`next.config.ts` support arrived in Next.js 15.)
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  images: {
    // Product photos live in Google Drive. We serve them directly instead of
    // running them through the Next.js image optimiser: Drive links redirect,
    // and the free Vercel plan limits how many images can be optimised.
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'drive.google.com' },
      { protocol: 'https', hostname: 'drive.usercontent.google.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
    ],
  },

  experimental: {
    // Keep heavy server-only libraries out of the bundler.
    serverComponentsExternalPackages: ['firebase-admin', 'googleapis', 'razorpay'],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
