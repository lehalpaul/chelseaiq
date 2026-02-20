import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/(chat)/api/chat": ["./data/toast.db"],
  },
};

export default nextConfig;
