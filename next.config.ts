import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // node-postgres has optional native bindings; load it from node_modules instead of bundling.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
