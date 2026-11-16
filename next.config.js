/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true, // starts the low-stock LISTEN worker + notification retry worker
    serverComponentsExternalPackages: ['pg', 'mongodb', 'bcryptjs'],
  },
};

module.exports = nextConfig;
