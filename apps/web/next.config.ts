import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // Product-request images are validated at 5 MiB in the server action.
    // Multipart framing adds overhead, so the framework envelope is 6 MiB.
    serverActions: { bodySizeLimit: "6mb" },
  },
  transpilePackages: ["@rava/config", "@rava/ui"],
};

export default nextConfig;
