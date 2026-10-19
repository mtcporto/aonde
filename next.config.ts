import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: "/index.html",
        destination: "/",
      },
      {
        source: "/detalhes.html",
        destination: "/detalhes",
      },
    ];
  },
};

export default nextConfig;
