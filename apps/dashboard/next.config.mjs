/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The dashboard talks to the API only through its own /bf proxy, so no rewrites
  // or CORS exceptions are needed and the secret key never reaches the browser.
  experimental: { typedRoutes: false },
};

export default nextConfig;
