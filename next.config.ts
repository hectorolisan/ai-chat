import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No server: everything runs in the browser.
  output: "export",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
