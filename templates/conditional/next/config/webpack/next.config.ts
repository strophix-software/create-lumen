import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Webpack configuration */
  webpack: (config) => {
    return config;
  },
};

export default nextConfig;
