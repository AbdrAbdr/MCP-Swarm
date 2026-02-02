/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Разрешаем доступ к API из родительской директории
  async rewrites() {
    return [
      {
        source: '/api/swarm/:path*',
        destination: 'http://localhost:3334/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
