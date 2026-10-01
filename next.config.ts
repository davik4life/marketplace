import type { NextConfig } from "next";

const nextConfig: NextConfig = {
 experimental: { serverMinification: false, serverSourceMaps: true, prerenderEarlyExit: false },
  
};

export default nextConfig;
