import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for Amazon S3 website hosting (eu-west-2).
  output: "export",
  images: {
    unoptimized: true,
  },
  // Generate /about/index.html so S3 website hosting resolves clean URLs.
  trailingSlash: true,
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
