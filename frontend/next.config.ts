import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF || '',
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'react-router-dom': path.resolve(__dirname, 'src/lib/next-router-dom.tsx'),
      '@': path.resolve(__dirname, 'src'),
    };
    return config;
  },
};

export default nextConfig;
