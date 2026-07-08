/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The engine ships as TypeScript source; Next transpiles it in-place.
  transpilePackages: ["kelly-engine"],
};

export default nextConfig;
