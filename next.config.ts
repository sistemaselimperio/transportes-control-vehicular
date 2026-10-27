import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shared reads opt in with `'use cache'` (in-memory, no remote handler); see src/lib/cache-tags.ts.
  cacheComponents: true,
  // Kept at the pre-existing prefetch behavior; flipping it is a separate decision.
  partialPrefetching: false,
  experimental: {
    serverActions: {
      // Files are up to 4 MB (MAX_FILE_BYTES); the limit counts multipart overhead too.
      bodySizeLimit: "4.5mb",
    },
  },
  async redirects() {
    // The maintenance placeholder became the logbook; keep old links (and their query) working.
    return [{ source: "/mantenimiento", destination: "/bitacora", permanent: true }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
