import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
