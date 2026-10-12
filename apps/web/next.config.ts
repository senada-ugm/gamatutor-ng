import type { NextConfig } from 'next';

const config: NextConfig = {
  // PGlite loads its WASM and data files from its own package directory.
  serverExternalPackages: ['@electric-sql/pglite'],
  // The player and schema are workspace TypeScript sources.
  transpilePackages: [
    '@gamatutor/course-player',
    '@gamatutor/course-schema',
    '@gamatutor/tracking',
  ],
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default config;
