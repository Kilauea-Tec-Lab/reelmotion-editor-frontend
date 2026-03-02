/** @type {import('next').NextConfig} */
const nextConfig = {
  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.reelmotion.ai',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'images.pexels.com',
      },
      {
        protocol: 'https',
        hostname: 'www.pexels.com',
      },
      {
        protocol: 'https',
        hostname: 'backend.reelmotion.ai',
      },
    ],
    // Increase timeout for image optimization in production
    minimumCacheTTL: 60,
  },
  // Allow large file uploads (500MB max)
  experimental: {
    serverComponentsExternalPackages: [
      "@remotion/bundler",
      "@remotion/renderer",
      "esbuild",
    ],
  },
  webpack: (config, { isServer }) => {
    // Handle platform-specific Remotion packages
    config.resolve = {
      ...config.resolve,
      fallback: {
        ...config.resolve?.fallback,
        // Darwin (macOS)
        "@remotion/compositor-darwin-x64": false,
        "@remotion/compositor-darwin-arm64": false,

        // Linux
        "@remotion/compositor-linux-x64": false,
        "@remotion/compositor-linux-arm64": false,
        "@remotion/compositor-linux-x64-musl": false,
        "@remotion/compositor-linux-arm64-musl": false,
        "@remotion/compositor-linux-x64-gnu": false,
        "@remotion/compositor-linux-arm64-gnu": false,

        // Windows
        "@remotion/compositor-win32-x64": false,
        "@remotion/compositor-windows-x64": false,

        // Handle esbuild
        esbuild: false,
      },
    };

    // Add esbuild to external modules
    if (isServer) {
      config.externals = [...config.externals, "esbuild"];
    }

    return config;
  },
};

export default nextConfig;
