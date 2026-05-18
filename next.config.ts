import type { NextConfig } from "next";
import { readFileSync } from "fs";
import path from "path";

const { version } = JSON.parse(
  readFileSync(path.join(__dirname, "package.json"), "utf8")
) as { version: string };

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
