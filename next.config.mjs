/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The app is entirely client-side, so emit a static bundle that Cloudflare
  // (or any static host) can serve directly — no Workers/OpenNext needed.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
