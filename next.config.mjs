/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // camera + geolocation are needed by the driver capture screen; microphone is not
  { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=()' },
];
const nextConfig = {
  serverExternalPackages: ['better-sqlite3', 'sharp'],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
export default nextConfig;
