import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000
  },
  headers: async () => [
    {
      source: "/:all*(mp4|mov|jpg|jpeg|png|webp|glb|hdr)",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
      ]
    }
  ]
};

export default nextConfig;
