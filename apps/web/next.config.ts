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
  // The workspace packages import their siblings as './x.js' (NodeNext
  // style) while the files are .ts. Turbopack cannot alias extensions, so the
  // app builds with webpack (see the --webpack flags in package.json).
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
  poweredByHeader: false,
};

export default config;
