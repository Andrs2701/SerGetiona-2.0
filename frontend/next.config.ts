import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tailwind CSS v4 funciona nativamente con Turbopack via @import "tailwindcss"
  // No requiere configuración PostCSS adicional
  turbopack: {
    rules: {
      // Permite que Turbopack procese CSS globales con Tailwind v4 nativo
    },
  },
};

export default nextConfig;
