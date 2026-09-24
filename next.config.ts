import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The directory store is read with fs at runtime, which file tracing can't see:
  // ship it with every server route (required on Vercel and other serverless hosts).
  outputFileTracingIncludes: {
    "/**": ["./data/store.json"],
  },
};

export default nextConfig;
