import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.mlstatic.com",
      },
    ],
  },
};

export default nextConfig;
