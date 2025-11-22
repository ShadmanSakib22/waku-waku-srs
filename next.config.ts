import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination:
          "https://waku-waku-53isx0jo2-shadman-sakibs-projects-5b2b209c.firebaseapp.com/__/auth/:path*",
      },
    ];
  },
};

export default nextConfig;
