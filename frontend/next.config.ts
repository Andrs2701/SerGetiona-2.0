import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Usa el postcss.config.js local dentro de Turbopack (fix para Tailwind v3)
    turbopackLocalPostcssConfig: true,
  },
};

export default nextConfig;
