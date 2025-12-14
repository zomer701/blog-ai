import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static HTML export (replaces `next export`)
  output: 'export',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
