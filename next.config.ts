import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Existing config options
  // Define the correct root for Turbopack to avoid workspace inference issues
  turbopack: {
    root: path.join(__dirname),
  },
  async rewrites() {
    return [
      {
        source: "/admin/dashboard",
        destination: "/dashboard",
      },
      {
        source: "/student/dashboard",
        destination: "/student-profile",
      },
    ];
  },
};

export default nextConfig;
