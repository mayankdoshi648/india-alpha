import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.cursor.com", "*.cursor.sh"],
  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "query", key: "view", value: "desk" }],
        destination: "/desk",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
