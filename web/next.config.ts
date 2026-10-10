import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // create-next-app turns cache components on. This client reads params and
  // fetches with SWR after login, so a route that touches params cannot be
  // prerendered. Leave the cache off until a page is actually static.
  cacheComponents: false,
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
