import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "radix-ui",
      "date-fns",
    ],
  },
};

export default nextConfig;
