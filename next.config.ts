import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow access from network IPs (e.g. 76.13.30.74) in development
  allowedDevOrigins: [
    "76.13.30.74",
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
  ],
  // OpenAlex needs longer timeouts in dev
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
