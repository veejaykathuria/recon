/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["neo4j-driver"]
  }
};

module.exports = nextConfig;
