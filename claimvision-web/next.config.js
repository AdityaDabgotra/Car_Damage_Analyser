/** @type {import('next').NextConfig} */
const nextConfig = {
  // Avoid Turbopack picking up a lockfile from a parent directory.
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: '100mb' },
  },
};

module.exports = nextConfig;
