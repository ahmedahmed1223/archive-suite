const archiveApiBaseUrl = process.env.ARCHIVE_API_BASE_URL?.replace(/\/$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  async rewrites() {
    if (!archiveApiBaseUrl) {
      return [];
    }

    return [
      {
        source: "/api/v1/:path*",
        destination: `${archiveApiBaseUrl}/:path*`
      }
    ];
  }
};

export default nextConfig;
