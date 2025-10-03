/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  images: {
    domains: [
      'cfhochnjniddaztgwrbk.supabase.co'
    ],
    unoptimized: true,
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
  // Ensure public directory assets are properly handled
  assetPrefix: process.env.NODE_ENV === 'production' ? '/' : '',
};

module.exports = nextConfig; 