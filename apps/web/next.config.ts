import type { NextConfig } from "next";

const developmentConnectSources =
  process.env.NODE_ENV === "development"
    ? " http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*"
    : "";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // Product-request images are validated at 5 MiB in the server action.
    // Multipart framing adds overhead, so the framework envelope is 6 MiB.
    serverActions: { bodySizeLimit: "6mb" },
  },
  transpilePackages: ["@rava/config", "@rava/ui"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'${developmentConnectSources}`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
