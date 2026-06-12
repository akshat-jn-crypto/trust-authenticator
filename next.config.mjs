/** @type {import('next').NextConfig} */
const nextConfig = {
  // A stray package-lock.json in the user home dir confuses root
  // detection; pin tracing to this project.
  outputFileTracingRoot: import.meta.dirname,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
