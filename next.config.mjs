/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    process.env.REPLIT_DEV_DOMAIN,
  ].filter(Boolean),
};

export default nextConfig;
