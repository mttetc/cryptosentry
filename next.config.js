/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Suppress the punycode warning
    config.ignoreWarnings = [{ module: /node_modules\/node-fetch\/lib\/index\.js/ }];
    return config;
  },
};

export default nextConfig;
