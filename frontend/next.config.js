/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  // disable: process.env.NODE_ENV === 'development',
});

const nextConfig = {
  images: {
    domains: ['localhost', '127.0.0.1'], // add production domains later
  },
};

module.exports = withPWA(nextConfig);
