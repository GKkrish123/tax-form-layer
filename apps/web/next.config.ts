import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Consume the workspace TypeScript packages directly (no prebuild step).
  transpilePackages: ['@tax-form-layer/spec', '@tax-form-layer/engine'],
  webpack: (config) => {
    // The workspace packages are TypeScript source using NodeNext-style ".js"
    // import specifiers; map them back to ".ts"/".tsx" for webpack resolution.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    // pdfjs-dist references `canvas` for Node; the browser build does not need it.
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
};

export default nextConfig;
